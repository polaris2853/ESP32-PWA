// Function to fetch uptime from ESP and start the stopwatch
function initStopWatch() {
	// 1. Fetch the data from the /uptime endpoint
	fetch("/uptime")
		.then(response => response.json()) // Expect JSON
		.then(uptimeSeconds => {
			// 4. Update the content of the HTML element
			const displayElement = document.getElementById("uptime-display");
			if (displayElement) {
				displayElement.textContent = uptimeSeconds.uptime;
			}
		})
		.catch(error => {
			// 5. Handle any errors during the fetch or processing
			console.error('There has been a problem with your fetch operation:', error);
			const displayElement = document.getElementById("uptime-display");
			if (displayElement) {
				displayElement.textContent = "Error fetching data";
			}
		});
}


// Call the function to begin the process when the page loads
setInterval(initStopWatch, 5000);

function displayFreeRAM() {
	// This fetches the new endpoint you created
	fetch("/ram")
		.then(response => response.text())
		.then(ramBytes => {
			const displayElement = document.getElementById("ram-display");
			if (displayElement) {
				displayElement.textContent = ramBytes;
			}
		})
		.catch(error => console.error('RAM fetch error:', error));
}

// Use setInterval to call this function periodically
displayFreeRAM(); // Run once immediately
setInterval(displayFreeRAM, 7000); // Run every 7 seconds