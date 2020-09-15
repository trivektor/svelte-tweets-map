<script>
	import {point, bbox, center, centroid, featureCollection} from 'turf';
	import {onMount} from 'svelte';
	import {map} from 'lodash';

	let mapInstance;
	let searchQuery = '';
	let searchQueryInput = '';
	let mostRecentId = '';
	const previousAnnotations = [];
	const seenTweets = {};
	const CUSTOM_MARKER_OPTIONS = {
		glyphImage: {
			1: '/Twitter_Logo_Blue.png',
		},
	};
	const UPDATE_INTERVAL = 2000;

	async function fetchTweets() {
		if (!searchQuery) return;

		const params = new URLSearchParams({
			q: searchQuery,
			result_type: 'recent',
			count: mostRecentId ? 100 : 10,
		});

		if (mostRecentId) {
			params.set('since_id', mostRecentId);
		}

		const response = await fetch(`http://localhost:8080/api/search?${params}`);
		const json = await response.json();
		const statuses = json.statuses.filter(({id}) => !seenTweets[id]);
		const locationMappings = json.locationMappings;

		statuses.forEach(({id}) => {
			seenTweets[id] = true;
		});

		if (statuses.length) {
			mostRecentId = Math.max(...map(statuses, "id"));
		}

		const annotations = statuses.map(({id, place, user, text}) => {
			if (place) {
				console.log({id, user, place, text});
				const {geometry: {coordinates: [lng, lat]}} = centroid(place.bounding_box);
				const mapkitCoordinate = new mapkit.Coordinate(lat, lng);

				return new mapkit.MarkerAnnotation(mapkitCoordinate, {
					...CUSTOM_MARKER_OPTIONS,
					title: `@${user.screen_name}: ${text}`,
				});
			} else {
				const geometryLocation = locationMappings[id];

				if (geometryLocation) {
					const {lat, lng, formatted_address} = geometryLocation;
					const mapkitCoordinate = new mapkit.Coordinate(lat, lng);

					return new mapkit.MarkerAnnotation(mapkitCoordinate, {
						...CUSTOM_MARKER_OPTIONS,
						title: `@${user.screen_name}: ${text}`,
					});
				}
			}
		}).filter(Boolean);

		if (annotations.length) {
			previousAnnotations.forEach((annotation) => {
				mapInstance.removeAnnotation(annotation);
			});

			previousAnnotations.push(...annotations);

			console.log({statuses, annotations, seenTweets});

			mapInstance.showItems(annotations, {animate: true});
		}
	}

	onMount(async () => {
		mapkit.init({
			authorizationCallback: function(done) {
				fetch('http://localhost:8080/api/jwt')
					.then((response) => response.text())
					.then((token) => {
						done(token);

						mapInstance = new mapkit.Map('map');

						fetchTweets();

						setInterval(() => {
							fetchTweets();
						}, UPDATE_INTERVAL);
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
		height: 100vh;
	}

	#query-form {
		position: absolute;
		top: 10px;
		left: 10px;
		right: 10px;
		z-index: 100;
	}

	#query-form input {
		border-radius: 4px;
		padding: 10px;
		display: block !important;
		width: 300px;
		border: 1px solid #bbb;
	}

	#query-form input:focus {
		outline: none;
		box-shadow: none;
	}
</style>

<main>
	<div id='query-form'>
		<form on:submit|preventDefault={setSearchQuery}>
			<input on:change={setSearchQueryInput} placeholder='Enter search query...' autofocus />
		</form>
	</div>
	<div id='map'></div>
</main>
