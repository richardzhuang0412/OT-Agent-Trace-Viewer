import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
import Home from "@/pages/Home";
import TaskPage from "@/pages/TaskPage";
import DatasetsPage from "@/pages/DatasetsPage";
import DatasetRowsPage from "@/pages/DatasetRowsPage";
import TracesPage from "@/pages/TracesPage";
import TraceBrowserPage from "@/pages/TraceBrowserPage";
import NotFound from "@/pages/not-found";

function RedirectToDatasets() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/datasets");
  }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/task/:date/:taskId" component={TaskPage} />
      <Route path="/traces/:datasetId" component={TraceBrowserPage} />
      <Route path="/traces" component={TracesPage} />
      <Route path="/datasets/:datasetId" component={DatasetRowsPage} />
      <Route path="/datasets" component={DatasetsPage} />
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
