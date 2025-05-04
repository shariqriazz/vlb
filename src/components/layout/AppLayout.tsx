"use client";

import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import Sidebar from "./Sidebar";
import { Toaster } from "@/components/ui/toaster"; // Import Toaster

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  // Keep track of the sidebar's actual width (can be '60px' or '250px')
  const [sidebarActualWidth, setSidebarActualWidth] = useState("250px");

  // Callback function for Sidebar to report its current width
  const handleSidebarResize = (width: string) => {
    setSidebarActualWidth(width);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar onResize={handleSidebarResize} />

      {/* Main Content Area */}
      {/* Apply margin-left dynamically based on sidebar width */}
      <main
        className="flex-1 overflow-y-auto p-6 transition-[margin-left] duration-200 ease-in-out"
        style={{ marginLeft: sidebarActualWidth }}
      >
        {children}
      </main>

      {/* Global Toaster */}
      <Toaster />
    </div>
  );
}
