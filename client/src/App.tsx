import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Contacts from "./pages/Contacts";
import ContactProfile from "./pages/ContactProfile";
import Lists from "./pages/Lists";
import Segments from "./pages/Segments";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignEditor from "./pages/CampaignEditor";
import Automations from "./pages/Automations";
import AutomationEditor from "./pages/AutomationEditor";
import Templates from "./pages/Templates";
import Domains from "./pages/Domains";
import SmtpSettings from "./pages/SmtpSettings";
import Team from "./pages/Team";
import OrgSettings from "./pages/OrgSettings";
import Reports from "./pages/Reports";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/app" nest>
        <AppLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/contacts" component={Contacts} />
            <Route path="/contacts/:id" component={ContactProfile} />
            <Route path="/lists" component={Lists} />
            <Route path="/segments" component={Segments} />
            <Route path="/campaigns" component={Campaigns} />
            <Route path="/reports" component={Reports} />
            <Route path="/campaigns/new" component={CampaignEditor} />
            <Route path="/campaigns/:id" component={CampaignDetail} />
            <Route path="/campaigns/:id/edit" component={CampaignEditor} />
            <Route path="/automations" component={Automations} />
            <Route path="/automations/new" component={AutomationEditor} />
            <Route path="/automations/:id" component={AutomationEditor} />
            <Route path="/templates" component={Templates} />
            <Route path="/domains" component={Domains} />
            <Route path="/smtp" component={SmtpSettings} />
            <Route path="/team" component={Team} />
            <Route path="/settings" component={OrgSettings} />
          </Switch>
        </AppLayout>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
