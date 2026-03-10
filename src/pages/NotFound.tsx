import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    // ANTI-FLASH DELAY: Wait 500ms before showing the 404 page.
    // This perfectly hides the 404 page during complex login/routing redirects.
    const timer = setTimeout(() => {
      setShow(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Return completely empty until the timer finishes
  if (!show) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">
        <h1 className="text-7xl font-bold text-[#4338CA] mb-2">404</h1>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
        <p className="text-sm text-gray-500 mb-8">
          The page or account dashboard you are looking for doesn't exist or you don't have permission to view it.
        </p>
        <Button 
          onClick={() => navigate('/dashboard', { replace: true })} 
          className="w-full bg-[#4338CA] hover:bg-[#4338CA]/90"
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
}