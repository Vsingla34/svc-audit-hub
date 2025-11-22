import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { MapPin, Users, Briefcase, TrendingUp, Shield, Clock } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Hero Section */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-primary">AuditHub</h1>
          </div>
          <Button onClick={() => navigate('/auth')}>
            Sign In
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Post Audit Management Portal
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Streamline audit assignments across India with intelligent matching, real-time tracking, and seamless payment processing
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/auth')}>
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/auth')}>
              Learn More
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-16">
          <h3 className="text-3xl font-bold text-center mb-12">Why Choose AuditHub?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <MapPin className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Pan-India Coverage</CardTitle>
                <CardDescription>
                  Manage audits across all states and cities with intelligent location-based matching
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Users className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Smart Auditor Matching</CardTitle>
                <CardDescription>
                  Automatically match assignments with qualified auditors based on location, expertise, and ratings
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Briefcase className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Assignment Management</CardTitle>
                <CardDescription>
                  Create, track, and manage audit assignments with ease. Bulk upload support for large-scale operations
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Clock className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Real-Time Tracking</CardTitle>
                <CardDescription>
                  Monitor assignment progress with GPS check-ins, deadline tracking, and automated reminders
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <Shield className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Secure KYC System</CardTitle>
                <CardDescription>
                  Comprehensive auditor verification with document validation and approval workflow
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <TrendingUp className="h-12 w-12 text-primary mb-4" />
                <CardTitle>Analytics & Reporting</CardTitle>
                <CardDescription>
                  Comprehensive dashboards with insights on assignments, auditor performance, and financial tracking
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="pt-6 text-center">
              <h3 className="text-3xl font-bold mb-4">Ready to Transform Your Audit Management?</h3>
              <p className="text-lg mb-6 opacity-90">
                Join hundreds of agencies and auditors already using AuditHub
              </p>
              <Button size="lg" variant="secondary" onClick={() => navigate('/auth')}>
                Create Account
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t mt-16">
          <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
            <p>© 2024 AuditHub. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default Index;
