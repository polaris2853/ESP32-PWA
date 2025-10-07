/* This initializes the Acess Point and LittleFS*/

#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>
//---------------------------------------------------
static unsigned long bootTime = 0;

const char* ap_ssids[] = {
    "ESP-WROOM-32",
    "FBI Surveillance Van #11",
    "NSA Drone Unit 7",
    "Area 51 Security Camera"
};
const char* ap_pass = "66667777";

const int num_ssids = 4; // Total number of SSIDs in the list
int current_ssid_index = 0;

// Time tracking variables for non-blocking SSID change
unsigned long last_ssid_change = 0;
const long ssid_change_interval = 600000; // Change every 10 minutes

WebServer server(80);

inline void rotateSSID() {
  unsigned long current_time = millis();
  if (current_time - last_ssid_change >= ssid_change_interval) {
      last_ssid_change = current_time;

      // Move to the next SSID in the list
      current_ssid_index = (current_ssid_index + 1) % num_ssids;

      // Restart the Access Point with the new SSID
      WiFi.softAP(ap_ssids[current_ssid_index], ap_pass);
      vTaskDelay(pdMS_TO_TICKS(150));
  }
}

inline void initFS() {
	if (!LittleFS.begin()) {
		Serial.println("LittleFS mount failed");
	}
	else {
		Serial.println("LittleFS mounted");
	}
}

inline void initWiFiAP() {
  WiFi.softAP(ap_ssids[current_ssid_index], ap_pass);
}

inline void handleRoot() {
  if (LittleFS.exists("/index.html")) {
    File f = LittleFS.open("/index.html", "r");
    server.streamFile(f, "text/html");
    f.close();
  }
  else {
    server.send(500, "text/plain", "index.html missing on LittleFS");
  }
}
inline void handleCss() {
  File file = LittleFS.open("/style.css", "r");
  if (!file) {
    server.send(404, "text/plain", "File not found");
    return;
  }
  server.streamFile(file, "text/css");
  file.close();
}

inline void handleJs() {
  File file = LittleFS.open("/script.js", "r");
  if (!file) {
    server.send(404, "text/plain", "File not found");
    return;
  }
  server.streamFile(file, "application/javascript");
  file.close();
}

inline void handleOMGGIF() {
  File file = LittleFS.open("/omggif.js", "r");
  if (!file) {
    server.send(404, "text/plain", "File not found");
    return;
  }
  server.streamFile(file, "application/javascript");
  file.close();
}

inline void handleNotFound() {
  server.send(404, "text/plain", "Not found");
} 

inline void handleStopWatch() {
  File file = LittleFS.open("/stopwatch.js", "r");
  if (!file) {
    server.send(404, "text/plain", "File not found");
    return;
  }
  server.streamFile(file, "application/javascript");
  file.close();
}
inline void handleUptime() {
	unsigned long uptimeSeconds = (millis() - bootTime) / 1000;
	String jsonResponse = "{\"uptime\":" + String(uptimeSeconds) + "}";

	// Change MIME type from "text/plain" to "application/json"
	server.send(200, "application/json", jsonResponse);
}



