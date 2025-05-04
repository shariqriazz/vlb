'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast'; // Shadcn toast hook
import {
  Home,
  Target,
  Settings,
  FileText,
  BarChart2,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from 'lucide-react';

interface NavItemProps {
  icon: LucideIcon;
  href: string;
  label: string;
  isActive?: boolean;
  isCollapsed?: boolean;
}

interface SidebarProps {
  onResize?: (width: string) => void;
}

const NavItem = ({ icon: Icon, href, label, isActive, isCollapsed }: NavItemProps) => {
  const buttonContent = (
    <Button
      variant={isActive ? 'secondary' : 'ghost'}
      className={cn('w-full justify-start', isCollapsed && 'justify-center px-2')}
      asChild
    >
      <Link href={href}>
        <Icon className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
        {!isCollapsed && <span className="text-sm">{label}</span>}
      </Link>
    </Button>
  );

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
};

export default function Sidebar({ onResize }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast(); // Shadcn toast
  const { theme, setTheme } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Effect to update sidebar width on initial load based on persisted state
  useEffect(() => {
    if (onResize) {
      onResize(isCollapsed ? '60px' : '250px');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After mount, read localStorage and update state if needed
  useEffect(() => {
    const savedState = localStorage.getItem('sidebarCollapsed');
    const initialValue = savedState ? JSON.parse(savedState) : false;
    if (initialValue !== isCollapsed) {
      setIsCollapsed(initialValue);
      if (onResize) {
        onResize(initialValue ? '60px' : '250px');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCollapse = () => {
    const newCollapsedState = !isCollapsed;
    setIsCollapsed(newCollapsedState);
    if (onResize) {
      onResize(newCollapsedState ? '60px' : '250px');
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(newCollapsedState));
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/logout', { method: 'POST' });
      if (response.ok) {
        toast({
          title: 'Logged Out',
          description: 'You have been successfully logged out.',
          variant: 'default', // Or 'success' if you customized variants
        });
        router.replace('/login');
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log out. Please try again.',
        variant: 'destructive',
      });
      console.error('Logout error:', error);
    }
  };

  const sidebarWidth = isCollapsed ? 'w-[60px]' : 'w-[250px]';
  const currentTheme = theme === 'system' ? 'light' : theme; // Assume light for system for icon logic

  return (
    <div
      className={cn(
        'relative flex h-full flex-col border-r bg-background transition-[width] duration-200 ease-in-out',
        sidebarWidth
      )}
    >
      {/* Collapse Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute z-10 w-8 h-8 rounded-full -right-4 top-2"
        onClick={toggleCollapse}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </Button>

      <div className="flex flex-col justify-between overflow-y-auto grow">
        {/* Top Section: Logo & Nav */}
        <div className="px-3 py-4">
          <div className={cn('mb-6 flex items-center px-2', isCollapsed ? 'justify-center' : 'justify-start')}>
            <h2 className="text-xl font-bold tracking-tight">
              {isCollapsed ? 'V' : 'Vertex AI LB'}
            </h2>
          </div>

          <nav className="flex flex-col space-y-1">
            <NavItem
              icon={Home}
              href="/dashboard"
              label="Dashboard"
              isActive={pathname === '/dashboard'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              icon={Target}
              href="/targets"
              label="Targets"
              isActive={pathname === '/targets'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              icon={FileText}
              href="/logs"
              label="Logs"
              isActive={pathname === '/logs'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              icon={BarChart2}
              href="/stats"
              label="Statistics"
              isActive={pathname === '/stats'}
              isCollapsed={isCollapsed}
            />
            <NavItem
              icon={Settings}
              href="/settings"
              label="Settings"
              isActive={pathname === '/settings'}
              isCollapsed={isCollapsed}
            />
          </nav>
        </div>

        {/* Bottom Section: Controls */}
        <div className="p-3 mt-auto">
          <Separator className="my-2" />
          {/* Theme Toggle */}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size={isCollapsed ? 'icon' : 'sm'}
                  className={cn('w-full', isCollapsed ? 'px-0' : 'justify-start')}
                  onClick={() => setTheme(currentTheme === 'dark' ? 'light' : 'dark')}
                >
                  {currentTheme === 'dark' ? (
                    <Sun className="w-4 h-4" />
                  ) : (
                    <Moon className="w-4 h-4" />
                  )}
                  {!isCollapsed && (
                    <span className="ml-2 text-sm">
                      {currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              {!isCollapsed ? null : (
                 <TooltipContent side="right">
                    {currentTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>

          {/* Logout Button */}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size={isCollapsed ? 'icon' : 'sm'}
                  className={cn('w-full text-red-600 hover:bg-red-100 hover:text-red-700 dark:text-red-500 dark:hover:bg-red-900/50 dark:hover:text-red-400', isCollapsed ? 'px-0' : 'justify-start')}
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />
                  {!isCollapsed && <span className="ml-2 text-sm">Logout</span>}
                </Button>
              </TooltipTrigger>
              {!isCollapsed ? null : (
                <TooltipContent side="right">Logout</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}