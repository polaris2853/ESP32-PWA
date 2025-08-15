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
  
  for (size_t f = 0; f < framesRam.size(); ++f) {
    // Draw the current frame
    for (int y = 0; y < MATRIX_HEIGHT; y++) {
      for (int x = 0; x < MATRIX_WIDTH; x++) {
        // Get the color from the current frame 'f'
        uint16_t linearIndex = (y * MATRIX_WIDTH) + x;
        // Set the color of the physical LED using the XY function
        leds[XY(x, y)] = framesRam[f][linearIndex];
      }
    }
  animateRGBRow(10);
  for (int b = 0; b < 8; ++b) leds[FRAME_PIXELS + b] = RGBRow[b];
  FastLED.show();
  vTaskDelay(pdMS_TO_TICKS(150)); // Delay to see the frame
  }
}
  
void loop() {
  animateRGBRow(1);
  for (int b = 0; b < 8; ++b) leds[FRAME_PIXELS + b] = RGBRow[b];
  FastLED.show();
  server.handleClient();
  // Check if it's time to rotate the SSID
  rotateSSID();
}