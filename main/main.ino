#include "config.h"
#include "JSON_render.h"

void setup() {
  Serial.begin(115200);
  delay(50);
  
  initFS();
  initLED();
  initWiFiAP();
  loadDefaultFromFS();
  initWebServer();
  startPlayTask();

  FastLED.show();
  vTaskDelay(pdMS_TO_TICKS(150)); // Delay to see the frame
  // }
}
  
void loop() {
  if (RGBEnabled) {
    animateRGBRow(1);
    for (int b = 0; b < 8; ++b) leds[56 + b] = RGBRow[b];
  }
  FastLED.show();
  server.handleClient();
  // Check if it's time to rotate the SSID
  rotateSSID();
  delay(1);
}