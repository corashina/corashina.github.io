import type { JSX } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { ContactPage } from "../pages/ContactPage";
import { HomePage } from "../pages/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProjectPage } from "../pages/ProjectPage";
import { WorksPage } from "../pages/WorksPage";

export function App(): JSX.Element {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="works" element={<WorksPage />} />
        <Route path="works/:slug" element={<ProjectPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
