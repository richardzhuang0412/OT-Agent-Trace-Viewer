import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import TaskPage from "@/pages/TaskPage";
import { QueryClientProvider } from "@tanstack/react-query";
import { Route, Switch } from "wouter";
import { queryClient } from "./lib/queryClient";

import TraceBrowserPage from "@/pages/TraceBrowserPage";
import TracesPage from "@/pages/TracesPage";
import TasksPage from "@/pages/TasksPage";
import TaskBrowserPage from "@/pages/TaskBrowserPage";
import HomePage from "@/pages/HomePage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/task/:date/:taskId" component={TaskPage} />
      <Route path="/traces/:datasetId" component={TraceBrowserPage} />
      <Route path="/traces" component={TracesPage} />
      <Route path="/tasks/:datasetId" component={TaskBrowserPage} />
      <Route path="/tasks" component={TasksPage} />

      <Route path="/s3" component={Home} />
      <Route path="/" component={HomePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <div className="dark">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
