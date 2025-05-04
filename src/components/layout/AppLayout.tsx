"use client";

import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import Sidebar from "./Sidebar";
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  // No longer need to track sidebar width here, let flexbox handle it.

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar - remove the onResize prop */}
      <Sidebar />

      {/* Main Content Area - remove dynamic marginLeft and transition */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* The Sidebar's width transition will naturally push this content */}
        {children}
      </main>

      {/* Global Toaster */}
      <Toaster />
    </div>
  );
}
