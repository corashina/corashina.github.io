import { lazy, Suspense, type JSX } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell, InitialRouteContent } from "../components/AppShell";

const HomePage = lazy(() =>
  import("../pages/HomePage").then(({ HomePage }) => ({ default: HomePage })),
);
const WorksPage = lazy(() =>
  import("../pages/WorksPage").then(({ WorksPage }) => ({ default: WorksPage })),
);
const ProjectPage = lazy(() =>
  import("../pages/ProjectPage").then(({ ProjectPage }) => ({ default: ProjectPage })),
);
const ContactPage = lazy(() =>
  import("../pages/ContactPage").then(({ ContactPage }) => ({ default: ContactPage })),
);
const NotFoundPage = lazy(() =>
  import("../pages/NotFoundPage").then(({ NotFoundPage }) => ({ default: NotFoundPage })),
);

const withRouteFallback = (page: JSX.Element): JSX.Element => (
  <Suspense fallback={<span aria-hidden="true" />}>
    <InitialRouteContent>{page}</InitialRouteContent>
  </Suspense>
);

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={withRouteFallback(<HomePage />)} />
        <Route path="works" element={withRouteFallback(<WorksPage />)} />
        <Route path="works/:slug" element={withRouteFallback(<ProjectPage />)} />
        <Route path="contact" element={withRouteFallback(<ContactPage />)} />
        <Route path="*" element={withRouteFallback(<NotFoundPage />)} />
      </Route>
    </Routes>
  );
}
