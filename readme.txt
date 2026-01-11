Macros App - Run Instructions

Quick Start (requires Java 17+ installed)
1) Open PowerShell in the repo root.
2) Run the server JAR:
   java -jar server\target\macro-server-1.0.0.jar --ui=../backend --port=8080
3) Open the UI in a browser:
   http://localhost:8080

Build the JAR (requires Maven)
1) Open PowerShell in the repo root.
2) Build:
   cd server
   mvn clean package
3) Run:
   java -jar target\macro-server-1.0.0.jar --ui=../backend --port=8080

Gemini API Key
- The key is hardcoded in:
  server\src\main\java\com\journeyhacks\server\MacroServer.java
- Edit this line:
  private static final String GEMINI_API_KEY = "PASTE_YOUR_KEY_HERE";
- Rebuild the JAR after changing the key.

Common Issues
- If you see "AI failed: 500", check the server console output.
- If you see a 404 model error, update GEMINI_MODEL in MacroServer.java
  to a model your key supports (use http://localhost:8080/ai/models).
- If you see a 429 quota error, your key has no remaining quota.
- Capture mouse position is very buggy

Stop
- Press the Stop button in the UI, or hit Esc / F6.

