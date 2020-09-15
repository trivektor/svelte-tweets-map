<script>
	import {centroid} from 'turf';
	import {onMount} from 'svelte';
	import {map} from 'lodash';

	const CUSTOM_MARKER_OPTIONS = {
		glyphImage: {
			1: '/Twitter_Logo_Blue.png',
		},
	};
	const mapkit = window.mapkit;
	const UPDATE_INTERVAL = 5000;
	const MINIMUM_SPAN = new mapkit.CoordinateSpan(30, 30);
	let mapInstance;
	let searchQuery = '';
	let searchQueryInput = '';
	let mostRecentId = '';
	let statuses = [];
	let locationMappings = {};
	let interval;

	async function fetchTweets() {
		if (!searchQuery) return;

		const params = new URLSearchParams({
			q: searchQuery,
			result_type: 'recent',
			count: 100,
			since_id: mostRecentId,
		});
		const response = await fetch(`http://localhost:8080/api/search?${params}`);
		const json = await response.json();

		if (!json.statuses.length) return;

		statuses = json.statuses;
		locationMappings = json.locationMappings;
		mostRecentId = Math.max(...map(statuses, "id"));

		const annotations = statuses.map(({id, place}) => {
			if (place) {
				const {geometry: {coordinates: [lng, lat]}} = centroid(place.bounding_box);

				return new mapkit.MarkerAnnotation(
					new mapkit.Coordinate(lat, lng),
					CUSTOM_MARKER_OPTIONS
				);
			} else if (locationMappings[id]) {
				const {lat, lng} = locationMappings[id];

				return new mapkit.MarkerAnnotation(
					new mapkit.Coordinate(lat, lng),
					CUSTOM_MARKER_OPTIONS
				);
			}
		}).filter(Boolean);

		mapInstance.annotations.forEach((annotation) => {
			mapInstance.removeAnnotation(annotation);
		});

		mapInstance.showItems(annotations, {
			animate: true,
			minimumSpan: MINIMUM_SPAN,
		});
	}

	function initialize() {
		mapkit.init({
			authorizationCallback: function(done) {
				fetch('http://localhost:8080/api/jwt')
					.then((response) => response.text())
					.then((token) => {
						done(token);

						mapInstance = new mapkit.Map('map');
					})
					.catch((err) => {
						console.error(err);
					});
			},
			language: 'en',
		});
	}

	async function submit() {
		searchQuery = searchQueryInput;

		if (interval) {
			clearInterval(interval);
		}

		await fetchTweets();

		interval = setInterval(() => {
			fetchTweets();
		}, UPDATE_INTERVAL);
	}

	function setSearchQueryInput(event) {
		searchQueryInput = event.target.value;
	}

	onMount(initialize);
</script>

<main>
	<div id='query-form'>
		<form on:submit|preventDefault={submit}>
			<input on:change={setSearchQueryInput} placeholder='Enter search query...' />
		</form>
	</div>
	<div id='map'></div>
	{#if statuses.length}
		<section id='tweets'>
			<ul>
				{#each statuses as status}
					<li>
						<strong>@{status.user.screen_name}:</strong>
						{status.text}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>
