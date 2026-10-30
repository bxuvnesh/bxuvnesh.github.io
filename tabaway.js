(function () {
  var lines = ["AYO come back", "bich", "Still Iconic", "eh?", "boom"];
  var original = document.title;
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      original = document.title;
      document.title = lines[Math.floor(Math.random() * lines.length)];
    } else {
      document.title = original;
    }
  });
})();
