import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import TaskPage from "@/pages/TaskPage";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";

import TraceBrowserPage from "@/pages/TraceBrowserPage";
import TracesPage from "@/pages/TracesPage";
import NotFound from "@/pages/not-found";

function RedirectToDatasets() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/traces");
  }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/task/:date/:taskId" component={TaskPage} />
      <Route path="/traces/:datasetId" component={TraceBrowserPage} />
      <Route path="/traces" component={TracesPage} />

      <Route path="/s3" component={Home} />
      <Route path="/" component={RedirectToDatasets} />
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
