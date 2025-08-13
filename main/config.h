/* This initializes the Acess Point and LittleFS*/

#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>

const char* ap_ssid = "ESP-WROOM-32";
const char* ap_pass = "66667777";

WebServer server(80);

inline void initFS() {
  if (!LittleFS.begin()) {
    Serial.println("LittleFS mount failed");
  }
  else {
    Serial.println("LittleFS mounted");
  }
}

inline void initWiFiAP() {
  WiFi.softAP(ap_ssid, ap_pass);
  Serial.print("AP IP: "); Serial.println(WiFi.softAPIP());
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




