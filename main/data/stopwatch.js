// Get the display element
const display = document.getElementById('display');


// Function to fetch uptime from ESP and start the stopwatch
function initializeStopwatch() {
	fetch('/uptime')
		.then(response => response.text())
		.then(uptimeSeconds => {
			stopwatchSeconds = parseInt(uptimeSeconds, 10);
			if (isNaN(stopwatchSeconds)) {
				console.error('Invalid uptime value from server.');
				display.textContent = "Error";
				return;
			}

			// Start the stopwatch interval
			if (stopwatchInterval) clearInterval(stopwatchInterval);
			stopwatchInterval = setInterval(() => {
				stopwatchSeconds++;
				display.textContent = formatTime(stopwatchSeconds);
			}, 1000);
		})
		.catch(error => {
			console.error('Error fetching initial uptime:', error);
			display.textContent = "Offline";
		});
}

// Call the function to begin the process when the page loads
initializeStopwatch();