/*This initializes the web app and renders the JSON*/

#include <FastLED.h>
#include <vector>
#include <array>
#include <ArduinoJson.h>

// ===== LED config =====
#define LED_PIN    23
#define NUM_LEDS   64
#define MATRIX_WIDTH 8
#define MATRIX_HEIGHT 7
#define LED_TYPE   WS2812B
#define COLOR_ORDER GRB
#define BRIGHTNESS 20

// ===== Frame config =====
#define FRAME_PIXELS 56
#define MAX_FRAMES 120

// ===== Extern declarations =====
CRGB leds[NUM_LEDS];
volatile bool playing = false;
std::vector<std::array<CRGB, FRAME_PIXELS>> framesRam;
TaskHandle_t playTask = NULL;

// ===== Battery row =====
const CRGB batteryRow[8] = {
  CRGB(0x00,0xFF,0x00), CRGB(0x00,0xFF,0x00),
  CRGB(0xFF,0xFF,0x00), CRGB(0xFF,0xFF,0x00),
  CRGB(0xFF,0x50,0x00), CRGB(0xFF,0x50,0x00),
  CRGB(0xFF,0x00,0x00), CRGB(0xFF,0x00,0x00)
};

// =====Serpentine layout/coordinate calculation =====
// uint16_t XY(uint8_t x, uint8_t y) {
//   // Check if the row is odd
//   if (y % 2 == 1) {
//     // If the row is odd, the data should be reversed
//     return (y * MATRIX_WIDTH) + (MATRIX_WIDTH - 1 - x);
//   } else {
//     // If the row is even, the data flows left-to-right
//     return (y * MATRIX_WIDTH) + x;
//   }
// }
uint16_t XY(uint8_t x, uint8_t y) {
  // Check if the row is even (index 0, 2, 4, 6)
  if (y % 2 == 0) {
    // Even rows flow right-to-left
    return (y * MATRIX_WIDTH) + (MATRIX_WIDTH - 1 - x);
  } else {
    // Odd rows flow left-to-right
    return (y * MATRIX_WIDTH) + x;
  }
}

// ===== Helper functions =====
inline bool hexToCRGB(const char* hex, CRGB& out) {
  if (!hex) return false;
  const char* p = (hex[0] == '#') ? hex + 1 : hex;
  if (strlen(p) != 6) return false;
  char buf[7]; memcpy(buf, p, 6); buf[6] = '\0';
  long val = strtol(buf, NULL, 16);
  if (val < 0) return false;
  out = CRGB((val >> 16) & 0xFF, (val >> 8) & 0xFF, val & 0xFF);
  return true;
}

// ===== LED Task =====
inline void playTaskFn(void* pvParameters) {
  while (true) {
    if (playing && framesRam.size() > 0) {
      for (size_t f = 0; playing && f < framesRam.size(); ++f) {
        // Draw the frame using the XY function
        for (int y = 0; y < MATRIX_HEIGHT; y++) {
          for (int x = 0; x < MATRIX_WIDTH; x++) {
            // Get the color from framesRam array using a linear index
            uint16_t linearIndex = (y * MATRIX_WIDTH) + x;
            // Set the color of the physical LED using the XY function
            leds[XY(x, y)] = framesRam[f][linearIndex];
          }
        }

        for (uint8_t b = 0; b < 8; ++b) leds[FRAME_PIXELS + b] = batteryRow[b];
        
        FastLED.show();
        vTaskDelay(pdMS_TO_TICKS(200));
      }
    }
    else {
      vTaskDelay(pdMS_TO_TICKS(100));
    }
  }
}

// ===== Web handlers =====
inline void respondText(int code, const char* txt) {
  server.send(code, "text/plain", txt);
}

inline void handleUpload() {
  if (server.method() != HTTP_POST) {
	respondText(405, "Method not allowed - use POST");
	return;
  }
  String body = server.arg("plain");
  if (body.length() == 0) {
	respondText(400, "Empty body");
	return;
  }

  size_t cap = body.length() * 1.5 + 1024;
  DynamicJsonDocument doc(cap);
  DeserializationError err = deserializeJson(doc, body);
  if (err) {
	String msg = "JSON parse error: "; msg += err.c_str();
	server.send(400, "text/plain", msg);
	return;
  }
  if (!doc.is<JsonArray>()) {
	respondText(400, "Top-level JSON must be an array of frames");
	return;
  }

  JsonArray framesArr = doc.as<JsonArray>();
  if (framesArr.size() == 0) {
	respondText(400, "No frames in upload");
	return;
  }
  if (framesArr.size() > MAX_FRAMES) {
	respondText(400, "Too many frames");
	return;
  }

  std::vector<std::array<CRGB, FRAME_PIXELS>> tmp;
  tmp.reserve(framesArr.size());

  for (JsonVariant f : framesArr) {
	if (!f.is<JsonArray>()) {
	  respondText(400, "Each frame must be an array");
	  return;
	}
	JsonArray pix = f.as<JsonArray>();
	if (pix.size() != 56 && pix.size() != 64) {
	  respondText(400, "Each frame must have 56 or 64 color elements");
	  return;
	}
	std::array<CRGB, FRAME_PIXELS> frameColors;
	for (uint16_t i = 0; i < FRAME_PIXELS; ++i) {
	  const char* hex = pix[i];
	  CRGB c;
	  if (!hexToCRGB(hex, c)) {
		respondText(400, "Bad color string (expected #RRGGBB or RRGGBB)");
		return;
	  }
	  frameColors[i] = c;
	}
	tmp.push_back(frameColors);
  }

  noInterrupts();
  framesRam.swap(tmp);
  interrupts();

  playing = true;
  server.send(200, "text/plain", "Uploaded and playing");
}

inline void handlePlay() { playing = true; server.send(200, "text/plain", "Playing"); }
inline void handleStop() { playing = false; server.send(200, "text/plain", "Stopped"); }
inline void handleInfo() {
  String s = String("{\"frames\":") + String(framesRam.size()) + "}";
  server.send(200, "application/json", s);
}

inline void initWebServer() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/upload", HTTP_POST, handleUpload);
  server.on("/play", HTTP_GET, handlePlay);
  server.on("/stop", HTTP_GET, handleStop);
  server.on("/info", HTTP_GET, handleInfo);
  server.begin();
  Serial.println("HTTP server started");
}

// ===== Load default.json =====
inline void loadDefaultFromFS() {
  if (!LittleFS.exists("/default.json")) {
	Serial.println("No default.json on LittleFS");
	return;
  }
  File f = LittleFS.open("/default.json", "r");
  if (!f) {
	Serial.println("default.json open failed");
	return;
  }
  String js = f.readString();
  f.close();

  size_t cap = js.length() * 1.5 + 1024;
  DynamicJsonDocument doc(cap);
  if (deserializeJson(doc, js)) {
	Serial.println("default.json parse failed");
	return;
  }
  if (!doc.is<JsonArray>()) return;
  JsonArray arr = doc.as<JsonArray>();

  std::vector<std::array<CRGB, FRAME_PIXELS>> tmp;
  tmp.reserve(arr.size());
  for (JsonVariant v : arr) {
	if (!v.is<JsonArray>()) continue;
	JsonArray pix = v.as<JsonArray>();
	if (pix.size() != 56 && pix.size() != 64) continue;
	std::array<CRGB, FRAME_PIXELS> frameColors;
	for (uint16_t i = 0; i < FRAME_PIXELS; ++i) {
	  const char* hex = pix[i];
	  CRGB c;
	  if (!hexToCRGB(hex, c)) c = CRGB::Black;
	  frameColors[i] = c;
	}
	tmp.push_back(frameColors);
  }
  if (!tmp.empty()) {
	framesRam.swap(tmp);
	Serial.printf("Loaded %u frames from default.json\n", (uint32_t)framesRam.size());
  }
}

// ===== Init functions =====
inline void initLED() {
  for (int y = 0; y < MATRIX_HEIGHT; y++) {
    for (int x = 0; x < MATRIX_WIDTH; x++) {
      uint8_t hue = map(y, 0, MATRIX_HEIGHT - 1, 0, 255);
      leds[XY(x, y)] = CHSV(hue, 255, 255);
    }
  }
  
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
}

inline void startPlayTask() {
  xTaskCreatePinnedToCore(playTaskFn, "playTask", 8192, NULL, 1, &playTask, 1);
}