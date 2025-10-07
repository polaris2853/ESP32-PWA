// Function to fetch uptime from ESP and start the stopwatch
function initializeStopwatch() {
    // 1. Fetch the data from the /uptime endpoint
    fetch("/uptime")
        .then(response => response.text())
        .then(uptimeSeconds => {
            // 4. Update the content of the HTML element
            const displayElement = document.getElementById("display");
            if (displayElement) {
                displayElement.textContent = uptimeSeconds;
            }
        })
        .catch(error => {
            // 5. Handle any errors during the fetch or processing
            console.error('There has been a problem with your fetch operation:', error);
            const displayElement = document.getElementById("display");
            if (displayElement) {
                displayElement.textContent = "Error fetching data";
            }
        });
}


// Call the function to begin the process when the page loads
initializeStopwatch();