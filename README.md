# SIGKILL: Terminal Cyber Warfare

## [ SYSTEM OVERVIEW ]
SIGKILL is a real-time, 1v1 tactical hacking simulator played directly in the browser. Operators connect to a shared subnet, manage their CPU threads, and lock in simultaneous payloads to attack, defend, and set up complex synergies. 

> **Inspiration & Attribution:**
> The simultaneous, blind-turn combat mechanics of this game were heavily inspired by the brilliant fighting game *Your Only Move Is HUSTLE* (YOMI Hustle). 

> **Development Transparency Note:**
> Up until this current version, this project was primarily "vibe coded" in collaboration with Google's Gemini AI. I acted as the project director, game designer, and QA tester, while Gemini handled the heavy lifting of writing the Node.js architecture, Socket.io logic, and CSS styling. I am leaving this note here for the sake of honest attribution—the AI wrote the bulk of this initial codebase through iterative pair-programming.

## [ CORE FEATURES ]
* **Simultaneous Turn Resolution:** Both players lock in their moves blindly. The server calculates the clash, synergies, and status effects instantly.
* **Dynamic Thread Economy:** Players start with base threads and must generate, save, or sacrifice them to cast heavier payloads.
* **15 Tactical Payloads:** Categorized into [ AGGRESSION ], [ DEFENSE ], and [ SETUP & RECOVERY ].
* **Lingering Status Effects:** Moves apply network statuses like [Congested], [Encrypted], [Traced], and [Weaponized].
* **Cinematic Execution:** Winning a duel physically executes a sudo kill -9 command on the opponent's kernel, taking their system offline.
* **Operator's Codex:** A built-in encyclopedia that explains the in-game mechanics alongside their real-world cybersecurity equivalents.
* **Cyberpunk UI:** Fully custom neon-dashboard styling with dynamic status tracking and colored terminal logging.

## [ TECH STACK ]
* **Backend:** Node.js, Express
* **Multiplayer Routing:** Socket.io
* **Frontend:** Vanilla HTML, CSS, JavaScript

## [ INSTALLATION & DEPLOYMENT ]

1. **Clone the repository:**
git clone https://github.com/YourUsername/sigkill.git
cd sigkill

2. **Install dependencies:**
npm install

3. **Initialize the Server:**
node server/server.js

4. **Access the Subnet:**
Open your browser and navigate to http://localhost:3000. To play against a friend locally or via a tunnel, share your IP or use a service like Localtunnel/Ngrok.

---
*Developed and maintained by Tomer Hamtsov.*

