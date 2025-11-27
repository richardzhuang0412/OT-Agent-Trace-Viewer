Harbor Job Visualization 
Motivation
The job visualization tool is primarily motivated by the pain points associated with debugging and understanding agent behavior from raw evaluation data. Harbor evaluation logs produce information that requires proper visualization to quickly diagnose failures, identify emergent behaviors, compare performance between different Harbor runs, and calculate cost estimates.
Goal 
Develop a dedicated visualization tool for the Harbor framework to render the results of job runs along with agent trajectories, making it easier to inspect and debug runs. The tool should present not only the trajectory but also rich metadata about each run. Key information includes:
Trajectory Timeline: A clear sequence of each interaction step (agent thoughts, actions/tool calls, observations/results, rewards, etc.), drawn from Harbor’s standardized ATIF logs.
Job Summary & Metadata: Overview of the entire run – e.g., job status (completed, failed, or running), total number of tasks/episodes executed, overall success/failure status, reward information, cumulative cost (e.g., API usage cost) and token usage, and total run duration.
Replay Video (Optional): Ability to generate a replay video of the trajectory, essentially animating the sequence of steps or showing the agent’s behavior over time 
Comparative View (Optional): Ability to load two trajectories side-by-side to compare different runs (for example, comparing two agent versions on the same task, or the same agent with different settings). For example, the trace compare feature in LangSmith.
Analysis (Optional): Features to assist trace analysis using a judge LLM that can annotate, critique, search, or manipulate the turns in the trajectory for precise analysis.
Design Approaches: build a standalone visualization tool (a locally runnable web app)

Standalone Tool
A framework specifically designed to view Harbor run logs by running a web server, where users can point the tool to job directory paths and explore them through a UI. The users can load multiple runs for visualization through the UI using a file picker or path input. The level of interactivity would be similar to OpenHands Trajectory Visualizer, VoltOps agent graphs, or Docent. 
The code for this tool could initially remain inside Harbor based on team preferences, but it might become heavy at some point, so we could consider making it a separate framework. 
It provides:
Support for rich interactivity (graphs, filters, diffing, real-time updates)
Suitability for advanced UI features and large trajectories
Requires more development/maintenance and separate tool setup for users
