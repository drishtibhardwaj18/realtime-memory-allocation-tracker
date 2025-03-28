
# System Memory Tracker

A real-time system memory monitoring tool that displays total, used, and free memory, along with the top memory-consuming applications and their processes. Built with a client-server architecture using WebSockets for dynamic updates.

## Features
- **Real-Time Monitoring:** Tracks system memory (total, used, free in GB) and updates every 2 seconds.
- **Top Applications:** Lists the top 10 memory-consuming apps with process details (PID, memory in MB, icons).
- **Cross-Platform:** Supports macOS and Windows (with plans for Linux).

## Project Structure
- **`index.html`**: Client-side UI displaying memory stats and app list.
- **`client.js`**: Handles WebSocket connections and UI updates.
- **`server.js`**: Server-side logic for memory data collection and broadcasting.
- **`public/`**: Static files (CSS, icons).

## Installation
1. **Clone the Repository:**
   ```bash
   git clone https://github.com/drishtibhardwaj18/realtime-memory-allocation-tracker.git
   cd system-memory-tracker
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
   Required packages: `express`, `socket.io`, `child_process`, `os`.

3. **Run the Server:**
   ```bash
   node server.js
   ```
   The server will start on `http://localhost:3000` by default.

## Usage
1. Open your browser and navigate to `http://localhost:3000`.
2. View real-time system memory stats and the top memory-consuming applications.
3. Click an app’s header to expand/collapse its process details.

## Technologies Used
- **Frontend:** HTML, JavaScript, CSS
- **Backend:** Node.js, Express.js, Socket.io
- **System Interaction:** Node.js `os` and `child_process` modules
- **Commands:**
  - macOS: `ps -A -m -o pid,rss,command`
  - Windows: `tasklist /FO CSV /NH`

## Key Code Snippets
### Server Initialization
```javascript
const app = express();
const server = http.createServer(app);
const io = socketIo(server);
app.use(express.static(path.join(__dirname, "public")));
server.listen(3000);
```

### Real-Time Updates
```javascript
io.on("connection", async (socket) => {
  const interval = setInterval(async () => {
    socket.emit("memoryUpdate", {
      system: getSystemMemory(),
      processes: await getProcessStats(),
    });
  }, 2000);
});
```

### UI Update
```javascript
socket.on("memoryUpdate", (data) => {
  updateElement(elements.total, data.system.total);
  elements.appList.innerHTML = data.processes.map(app => /* HTML */).join("");
});
```


## Future Scope
- Add Linux support.
- Include CPU, disk, and network usage tracking.
- Implement alerts for high memory usage.
- Improve app name grouping and icon resolution.



