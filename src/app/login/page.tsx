'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Loader2 } from 'lucide-react'; // Import Loader2 for loading state

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast'; // Use the shadcn/ui toast hook

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast(); // Destructure toast from the hook

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        // Redirect to dashboard on successful login
        router.push('/dashboard');
        toast({
          title: 'Login Successful',
          variant: 'default', // Use appropriate variant if needed, default is fine
        });
      } else {
        const data = await response.json();
        throw new Error(data.message || 'Invalid password');
      }
    } catch (error: any) {
      toast({
        title: 'Login Failed',
        description: error.message || 'An error occurred during login.',
        variant: 'destructive', // Use destructive variant for errors
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Use Tailwind for layout - center content vertically and horizontally
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      {/* Use Card component for the login box */}
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
           {/* Use Lucide icon */}
          <div className="flex justify-center mb-4">
             <LogIn className="w-10 h-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>
            Enter the password to access the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="grid items-center w-full gap-4">
              {/* Form field */}
              <div className="flex flex-col space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  disabled={isLoading} // Disable input when loading
                />
              </div>
              {/* Submit button */}
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading} // Disable button when loading
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Logging in...
                  </>
                ) : (
                  'Login'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}