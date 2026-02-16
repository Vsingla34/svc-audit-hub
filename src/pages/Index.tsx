import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, Briefcase, TrendingUp, Shield, Clock, ArrowRight, CheckCircle } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: MapPin,
      title: 'Pan-India Coverage',
      description: 'Manage audits across all states and cities with intelligent location-based matching',
    },
    {
      icon: Users,
      title: 'Smart Auditor Matching',
      description: 'Automatically match assignments with qualified auditors based on location, expertise, and ratings',
    },
    {
      icon: Briefcase,
      title: 'Assignment Management',
      description: 'Create, track, and manage audit assignments with ease. Bulk upload support for large-scale operations',
    },
    {
      icon: Clock,
      title: 'Real-Time Tracking',
      description: 'Monitor assignment progress with GPS check-ins, deadline tracking, and automated reminders',
    },
    {
      icon: Shield,
      title: 'Secure KYC System',
      description: 'Comprehensive auditor verification with document validation and approval workflow',
    },
    {
      icon: TrendingUp,
      title: 'Analytics & Reporting',
      description: 'Comprehensive dashboards with insights on assignments, auditor performance, and financial tracking',
    },
  ];

  const stats = [
    { value: '500+', label: 'Active Auditors' },
    { value: '10K+', label: 'Audits Completed' },
    { value: '28', label: 'States Covered' },
    { value: '99%', label: 'On-Time Delivery' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Color Change: Logo Background */}
            <div className="h-9 w-9 rounded-lg bg-[#4F46E5] flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <span className="font-heading text-xl font-semibold">AuditHub</span>
          </div>
          {/* Color Change: Header Button */}
          <Button 
            onClick={() => navigate('/auth')}
            className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white"
          >
            Sign In
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Color Change: Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#4F46E5]/5 via-transparent to-accent/10" />
          <div className="container mx-auto px-6 py-24 md:py-32 relative">
            <div className="max-w-3xl mx-auto text-center">
              {/* Color Change: Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4F46E5]/10 text-[#4F46E5] text-sm font-medium mb-6">
                <CheckCircle className="h-4 w-4" />
                Trusted by 100+ agencies across India
              </div>
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Post Audit Management
                {/* Color Change: Highlight Text */}
                <span className="block text-[#4F46E5]">Made Simple</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
                Streamline audit assignments across India with intelligent matching, real-time tracking, and seamless payment processing
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {/* Color Change: Primary Button */}
                <Button 
                  size="xl" 
                  onClick={() => navigate('/auth')}
                  className="bg-[#4F46E5] hover:bg-[#4F46E5]/90 text-white"
                >
                  Get Started Free
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                {/* Color Change: Outline Button */}
                <Button 
                  size="xl" 
                  variant="outline" 
                  onClick={() => navigate('/auth')}
                  className="border-[#4F46E5] text-[#4F46E5] hover:bg-[#4F46E5]/10 bg-transparent"
                >
                  View Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="border-y bg-muted/30">
          <div className="container mx-auto px-6 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  {/* Color Change: Stat Numbers */}
                  <div className="font-heading text-3xl md:text-4xl font-bold text-[#4F46E5] mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Everything you need to manage audits
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A complete solution for agencies and auditors to collaborate efficiently
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="card-interactive border-transparent hover:border-border">
                <CardHeader className="pb-3">
                  {/* Color Change: Feature Icons */}
                  <div className="h-12 w-12 rounded-lg bg-[#4F46E5]/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-[#4F46E5]" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-6 py-16">
          {/* Color Change: Card Background */}
          <Card className="bg-[#4F46E5] text-white border-0 overflow-hidden relative">
            {/* Color Change: Card Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#4F46E5] via-[#4F46E5] to-[#4F46E5]/80" />
            <CardContent className="relative py-12 md:py-16 text-center">
              <h3 className="font-heading text-2xl md:text-3xl font-bold mb-4">
                Ready to transform your audit management?
              </h3>
              <p className="text-lg mb-8 opacity-90 max-w-xl mx-auto">
                Join hundreds of agencies and auditors already using AuditHub
              </p>
              {/* Color Change: CTA Button (White background with Indigo text) */}
              <Button 
                size="xl" 
                variant="secondary" 
                className="bg-white text-[#4F46E5] hover:bg-white/90"
                onClick={() => navigate('/auth')}
              >
                Create Free Account
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t">
          <div className="container mx-auto px-6 py-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Color Change: Footer Logo */}
                <div className="h-8 w-8 rounded-lg bg-[#4F46E5] flex items-center justify-center">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <span className="font-heading font-semibold">AuditHub</span>
              </div>
              <p className="text-sm text-muted-foreground">
                © 2024 AuditHub. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;