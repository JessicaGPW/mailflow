import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AppLayout = lazy(() => import("./components/AppLayout"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Contacts = lazy(() => import("./pages/Contacts"));
const ContactProfile = lazy(() => import("./pages/ContactProfile"));
const Lists = lazy(() => import("./pages/Lists"));
const Segments = lazy(() => import("./pages/Segments"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const CampaignEditor = lazy(() => import("./pages/CampaignEditor"));
const Automations = lazy(() => import("./pages/Automations"));
const AutomationEditor = lazy(() => import("./pages/AutomationEditor"));
const Templates = lazy(() => import("./pages/Templates"));
const Domains = lazy(() => import("./pages/Domains"));
const SmtpSettings = lazy(() => import("./pages/SmtpSettings"));
const Team = lazy(() => import("./pages/Team"));
const OrgSettings = lazy(() => import("./pages/OrgSettings"));
const Reports = lazy(() => import("./pages/Reports"));

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
      Carregando MailFlow...
    </div>
  );
}

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
          <Suspense fallback={<RouteLoading />}>
            <AppRouter />
          </Suspense>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
