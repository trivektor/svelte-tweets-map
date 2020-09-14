<script>
	import {point, bbox, center, featureCollection} from 'turf';
	import {onMount} from 'svelte';

	let map;
	let searchQuery = '';
	let searchQueryInput = '';
	const previousAnnotations = [];
	const seenTweets = {};
	const CUSTOM_MARKER_OPTIONS = {
		glyphImage: {
			1: '/Twitter_Logo_Blue.png',
		},
	};

	async function fetchTweets() {
		if (!searchQuery) return;

		const params = new URLSearchParams({
			q: searchQuery,
			result_type: 'recent',
			max_results: 100,
		});
		const response = await fetch(`http://localhost:8080/api/search?${params}`);
		const json = await response.json();
		const statuses = json.statuses.filter(({id}) => !seenTweets[id]);
		const locationMappings = json.locationMappings;

		statuses.forEach(({id}) => {
			seenTweets[id] = true;
		});

		const annotations = statuses.map(({id, place, text}) => {
			if (place) {
				const coordinates = place.bounding_box.coordinates[0];
				const features = featureCollection(coordinates.map((pair) => point(pair)));
				const {geometry: {lat, lng}} = center(features);
				const mapkitCoordinate = new mapkit.Coordinate(lat, lng);

				return new mapkit.MarkerAnnotation(mapkitCoordinate, CUSTOM_MARKER_OPTIONS);
			} else {
				const geometryLocation = locationMappings[id];

				if (geometryLocation) {
					const {lat, lng} = geometryLocation;
					const mapkitCoordinate = new mapkit.Coordinate(lat, lng);

					return new mapkit.MarkerAnnotation(mapkitCoordinate, CUSTOM_MARKER_OPTIONS);
				}
			}
		}).filter(Boolean);

		if (annotations.length) {
			previousAnnotations.forEach((annotation) => {
				map.removeAnnotation(annotation);
			});

			previousAnnotations.push(...annotations);

			console.log({statuses, annotations});

			map.showItems(annotations, {
				animate: true,
				minimumSpan: new mapkit.CoordinateSpan(30, 30),
			});
		}
	}

	onMount(async () => {
		mapkit.init({
			authorizationCallback: function(done) {
				fetch('http://localhost:8080/api/jwt')
					.then((response) => response.text())
					.then((token) => {
						done(token);

						map = new mapkit.Map('map');

						fetchTweets();

						setInterval(() => {
							fetchTweets();
						}, 2000);
					})
					.catch((err) => {
						console.error(err);
					});
			},
			language: 'en',
		});
	});

	function setSearchQuery() {
		searchQuery = searchQueryInput;
	}

	function setSearchQueryInput(event) {
		searchQueryInput = event.target.value;
	}
</script>

<style>
	html,
	body {
		margin: 0 !important;
		padding: 0 !important;
		font-family: Arial;
	}

	#map {
		height: calc(100vh - 70px);
	}
</style>

<main>
	<div>
		<form on:submit|preventDefault={setSearchQuery}>
			<input style='width: 100%' on:change={setSearchQueryInput} placeholder='Enter search query' />
		</form>
	</div>
	<div id='map'></div>
</main>
