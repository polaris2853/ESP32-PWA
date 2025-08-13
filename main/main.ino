#include "config.h"
#include "JSON_render.h"

void setup() {
  Serial.begin(115200);
  delay(50);
  
  initFS();
  initLED();
  loadDefaultFromFS();
  initWiFiAP();
  initWebServer();
  startPlayTask();

  // Nếu chưa có frame nào thì tạo frame trống
  if (framesRam.empty()) {
    std::array<CRGB, FRAME_PIXELS> blank;
    blank.fill(CRGB::Black);
    framesRam.push_back(blank);
  }

  // Hiển thị frame đầu + battery row
  // This loop iterates through all 64 pixels of the matrix
  // and uses the XY function to place the color at the correct physical location.
  for (int y = 0; y < MATRIX_HEIGHT; y++) {
    for (int x = 0; x < MATRIX_WIDTH; x++) {
      // Get the color from your framesRam array using a linear index
      uint16_t linearIndex = (y * MATRIX_WIDTH) + x;
      // Set the color of the physical LED using the XY function
      leds[XY(x, y)] = framesRam[0][linearIndex];
    }
  }
  for (uint8_t b = 0; b < 8; ++b) leds[FRAME_PIXELS + b] = batteryRow[b];

  
  FastLED.show();
}

void loop() {
  

  
  server.handleClient();
}