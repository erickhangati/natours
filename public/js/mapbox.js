/* eslint-disable */

export const displayMapbox = (locations) => {
  mapboxgl.accessToken =
    'pk.eyJ1IjoiZWtoYW5nYXRpIiwiYSI6ImNsNWo4YTg0cDBmazIzZHBsOHN3MG54aTYifQ.bkbk53VKr6JqQgrDRQhKCg';

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/ekhangati/cl5jof5xv00ng14ll3tr9gbf7',
    scrollZoom: false,
  });

  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach((loc) => {
    // Create a marker
    const el = document.createElement('div');
    el.className = 'marker';

    // Add Marker
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    // Add Popup Description
    new mapboxgl.Popup({
      offset: 40,
    })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
      .addTo(map);

    //Extend map bounds to include current location
    bounds.extend(loc.coordinates);
  });

  map.fitBounds(bounds, {
    padding: {
      top: 200,
      bottom: 150,
      left: 100,
      right: 100,
    },
  });
};
