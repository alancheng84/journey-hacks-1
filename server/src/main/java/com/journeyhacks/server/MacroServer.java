package com.journeyhacks.server;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.awt.AWTException;
import java.awt.Desktop;
import java.awt.MouseInfo;
import java.awt.Point;
import java.awt.Robot;
import java.awt.event.KeyEvent;
import java.awt.event.InputEvent;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

public class MacroServer {
  private static final ObjectMapper MAPPER = new ObjectMapper()
      .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  private final ExecutorService macroExecutor = Executors.newSingleThreadExecutor();
  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicReference<MacroRequest> lastRequest = new AtomicReference<>();
  private final AtomicReference<Thread> macroThread = new AtomicReference<>();
  private Robot robot;

  public static void main(String[] args) throws Exception {
    int port = 8080;
    Path uiRoot = Paths.get("backend").toAbsolutePath().normalize();

    for (String arg : args) {
      if (arg.startsWith("--port=")) {
        port = Integer.parseInt(arg.substring("--port=".length()));
      } else if (arg.startsWith("--ui=")) {
        uiRoot = Paths.get(arg.substring("--ui=".length())).toAbsolutePath().normalize();
      }
    }

    new MacroServer().start(port, uiRoot);
  }

  private void start(int port, Path uiRoot) throws IOException {
    try {
      robot = new Robot();
      robot.setAutoDelay(10);
    } catch (AWTException e) {
      throw new IOException("Failed to initialize Robot. Are you running with a desktop session?", e);
    }

    HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
    server.createContext("/macros/run", new RunHandler());
    server.createContext("/macros/stop", new StopHandler());
    server.createContext("/mouse/position", new MousePositionHandler());
    server.createContext("/", new StaticHandler(uiRoot));
    server.setExecutor(Executors.newCachedThreadPool());
    server.start();

    System.out.println("Macro server running on http://localhost:" + port + "/");
    System.out.println("UI root: " + uiRoot);
  }

  private class RunHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange exchange) throws IOException {
      if (handleOptions(exchange)) {
        return;
      }
      if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
        sendJson(exchange, 405, Map.of("message", "Method not allowed"));
        return;
      }

      String body = readBody(exchange);
      MacroRequest request = MAPPER.readValue(body, MacroRequest.class);
      if (request.steps == null) {
        request.steps = List.of();
      }
      lastRequest.set(request);
      running.set(false);
      Thread current = macroThread.getAndSet(null);
      if (current != null) {
        current.interrupt();
      }
      running.set(true);

      macroExecutor.submit(() -> runMacroSteps(request.steps));

      sendJson(exchange, 200, Map.of(
          "message", "Run started.",
          "steps", request.steps.size()
      ));
    }
  }

  private class StopHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange exchange) throws IOException {
      if (handleOptions(exchange)) {
        return;
      }
      if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
        sendJson(exchange, 405, Map.of("message", "Method not allowed"));
        return;
      }

      running.set(false);
      Thread current = macroThread.getAndSet(null);
      if (current != null) {
        current.interrupt();
      }
      sendJson(exchange, 200, Map.of("message", "Stopped."));
    }
  }

  private class MousePositionHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange exchange) throws IOException {
      if (handleOptions(exchange)) {
        return;
      }
      if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
        sendJson(exchange, 405, Map.of("message", "Method not allowed"));
        return;
      }

      Point point = MouseInfo.getPointerInfo().getLocation();
      sendJson(exchange, 200, Map.of("x", point.x, "y", point.y));
    }
  }

  private static class StaticHandler implements HttpHandler {
    private final Path root;

    private StaticHandler(Path root) {
      this.root = root;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
      URI uri = exchange.getRequestURI();
      String path = uri.getPath();
      if (path == null || path.isBlank() || "/".equals(path)) {
        path = "/index.html";
      }

      Path file = root.resolve(path.substring(1)).normalize();
      if (!file.startsWith(root)) {
        sendText(exchange, 403, "Forbidden");
        return;
      }
      if (Files.isDirectory(file)) {
        file = file.resolve("index.html");
      }
      if (!Files.exists(file)) {
        sendText(exchange, 404, "Not found");
        return;
      }

      String contentType = contentType(file);
      Headers headers = exchange.getResponseHeaders();
      headers.set("Content-Type", contentType);

      long length = Files.size(file);
      exchange.sendResponseHeaders(200, length);
      try (InputStream in = Files.newInputStream(file); OutputStream out = exchange.getResponseBody()) {
        in.transferTo(out);
      }
    }
  }

  private static boolean handleOptions(HttpExchange exchange) throws IOException {
    if (!"OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
      return false;
    }
    Headers headers = exchange.getResponseHeaders();
    headers.add("Access-Control-Allow-Origin", "*");
    headers.add("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.add("Access-Control-Allow-Headers", "Content-Type");
    exchange.sendResponseHeaders(204, -1);
    return true;
  }

  private static void sendJson(HttpExchange exchange, int status, Object payload) throws IOException {
    byte[] data = MAPPER.writeValueAsBytes(payload);
    Headers headers = exchange.getResponseHeaders();
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.add("Access-Control-Allow-Origin", "*");
    headers.add("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.add("Access-Control-Allow-Headers", "Content-Type");
    exchange.sendResponseHeaders(status, data.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(data);
    }
  }

  private static void sendText(HttpExchange exchange, int status, String message) throws IOException {
    byte[] data = message.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().set("Content-Type", "text/plain; charset=utf-8");
    exchange.sendResponseHeaders(status, data.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(data);
    }
  }

  private static String readBody(HttpExchange exchange) throws IOException {
    try (InputStream in = exchange.getRequestBody()) {
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  private static String contentType(Path file) {
    String name = file.getFileName().toString().toLowerCase();
    if (name.endsWith(".html")) {
      return "text/html; charset=utf-8";
    }
    if (name.endsWith(".css")) {
      return "text/css; charset=utf-8";
    }
    if (name.endsWith(".js")) {
      return "application/javascript; charset=utf-8";
    }
    if (name.endsWith(".json")) {
      return "application/json; charset=utf-8";
    }
    if (name.endsWith(".svg")) {
      return "image/svg+xml";
    }
    if (name.endsWith(".png")) {
      return "image/png";
    }
    return "application/octet-stream";
  }

  private void runMacroSteps(List<Map<String, Object>> steps) {
    macroThread.set(Thread.currentThread());
    try {
      for (Map<String, Object> step : steps) {
        if (!running.get()) {
          break;
        }
        String type = asString(step.get("type"));
        if (type == null) {
          continue;
        }
        switch (type) {
          case "MOUSE_MOVE":
            moveMouseBy(step);
            break;
          case "MOUSE_MOVE_TO":
            moveMouseTo(step);
            break;
          case "MOUSE_CLICK":
            clickMouse(step);
            break;
          case "TYPE_TEXT":
            typeText(step);
            break;
          case "WAIT_MS":
            waitMs(step);
            break;
          case "CTRL_KEY":
            pressCtrlKey(step);
            break;
          case "PRESS_KEY":
            pressKey(step);
            break;
          case "OPEN_URL":
            openUrl(step);
            break;
          case "REPEAT":
            repeatSteps(step);
            break;
          case "SET_MODE":
          case "START":
          default:
            break;
        }
        sleepQuietly(20);
      }
    } finally {
      running.set(false);
      macroThread.set(null);
    }
  }

  private void moveMouseBy(Map<String, Object> step) {
    Point point = MouseInfo.getPointerInfo().getLocation();
    int dx = asInt(step.get("dx"));
    int dy = asInt(step.get("dy"));
    robot.mouseMove(point.x + dx, point.y + dy);
  }

  private void moveMouseTo(Map<String, Object> step) {
    int x = asInt(step.get("x"));
    int y = asInt(step.get("y"));
    robot.mouseMove(x, y);
  }

  private void clickMouse(Map<String, Object> step) {
    String button = asString(step.get("button"));
    int count = Math.max(1, asInt(step.get("count")));
    int mask = InputEvent.BUTTON1_DOWN_MASK;
    if ("RIGHT".equalsIgnoreCase(button)) {
      mask = InputEvent.BUTTON3_DOWN_MASK;
    }
    for (int i = 0; i < count && running.get(); i++) {
      robot.mousePress(mask);
      robot.mouseRelease(mask);
      sleepQuietly(60);
    }
  }

  private void typeText(Map<String, Object> step) {
    String text = asString(step.get("text"));
    if (text == null || text.isEmpty()) {
      return;
    }
    for (char ch : text.toCharArray()) {
      if (!running.get()) {
        break;
      }
      typeChar(ch);
    }
  }

  private void waitMs(Map<String, Object> step) {
    int ms = Math.max(0, asInt(step.get("ms")));
    sleepQuietly(ms);
  }

  private void pressCtrlKey(Map<String, Object> step) {
    String key = asString(step.get("key"));
    if (key == null || key.isBlank()) {
      return;
    }
    int keyCode = mapKeyCode(key);
    if (keyCode == KeyEvent.VK_UNDEFINED) {
      return;
    }
    robot.keyPress(KeyEvent.VK_CONTROL);
    robot.keyPress(keyCode);
    robot.keyRelease(keyCode);
    robot.keyRelease(KeyEvent.VK_CONTROL);
  }

  private void pressKey(Map<String, Object> step) {
    String key = asString(step.get("key"));
    if (key == null || key.isBlank()) {
      return;
    }
    if ("CTRL_L".equalsIgnoreCase(key)) {
      robot.keyPress(KeyEvent.VK_CONTROL);
      robot.keyPress(KeyEvent.VK_L);
      robot.keyRelease(KeyEvent.VK_L);
      robot.keyRelease(KeyEvent.VK_CONTROL);
      return;
    }
    int keyCode;
    switch (key.toUpperCase()) {
      case "ENTER":
        keyCode = KeyEvent.VK_ENTER;
        break;
      case "ESCAPE":
        keyCode = KeyEvent.VK_ESCAPE;
        break;
      default:
        keyCode = KeyEvent.VK_UNDEFINED;
        break;
    }
    if (keyCode == KeyEvent.VK_UNDEFINED) {
      return;
    }
    robot.keyPress(keyCode);
    robot.keyRelease(keyCode);
  }

  private void openUrl(Map<String, Object> step) {
    String url = asString(step.get("url"));
    if (url == null || url.isBlank()) {
      return;
    }
    try {
      if (Desktop.isDesktopSupported()) {
        Desktop.getDesktop().browse(URI.create(url));
      }
    } catch (Exception ignored) {
      // Best-effort only.
    }
  }

  @SuppressWarnings("unchecked")
  private void repeatSteps(Map<String, Object> step) {
    int count = Math.max(1, asInt(step.get("count")));
    Object nested = step.get("steps");
    if (!(nested instanceof List)) {
      return;
    }
    List<Map<String, Object>> nestedSteps = (List<Map<String, Object>>) nested;
    for (int i = 0; i < count && running.get(); i++) {
      runMacroSteps(nestedSteps);
    }
  }

  private static int mapKeyCode(String key) {
    switch (key.toUpperCase()) {
      case "A":
        return KeyEvent.VK_A;
      case "C":
        return KeyEvent.VK_C;
      case "V":
        return KeyEvent.VK_V;
      default:
        return KeyEvent.VK_UNDEFINED;
    }
  }

  private void typeChar(char ch) {
    int keyCode = KeyEvent.getExtendedKeyCodeForChar(ch);
    if (keyCode == KeyEvent.VK_UNDEFINED) {
      return;
    }
    boolean upper = Character.isUpperCase(ch) || isShiftRequired(ch);
    if (upper) {
      robot.keyPress(KeyEvent.VK_SHIFT);
    }
    robot.keyPress(keyCode);
    robot.keyRelease(keyCode);
    if (upper) {
      robot.keyRelease(KeyEvent.VK_SHIFT);
    }
    sleepQuietly(20);
  }

  private static boolean isShiftRequired(char ch) {
    return "~!@#$%^&*()_+{}|:\"<>?".indexOf(ch) >= 0;
  }

  private static int asInt(Object value) {
    if (value instanceof Number) {
      return ((Number) value).intValue();
    }
    if (value instanceof String) {
      try {
        return Integer.parseInt((String) value);
      } catch (NumberFormatException ignored) {
        return 0;
      }
    }
    return 0;
  }

  private static String asString(Object value) {
    if (value == null) {
      return null;
    }
    return value.toString();
  }

  private static void sleepQuietly(long millis) {
    try {
      Thread.sleep(millis);
    } catch (InterruptedException ignored) {
      Thread.currentThread().interrupt();
    }
  }

  public static class MacroRequest {
    public List<Map<String, Object>> steps;
  }
}
