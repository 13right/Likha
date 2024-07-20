window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
      // If the page was cached, force a reload
      window.location.reload();
    }
  });