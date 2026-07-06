import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trophy, 
  Gift, 
  TrendingUp, 
  DollarSign, 
  ArrowUpRight, 
  Clock,
  CheckCircle2,
  Wallet
} from 'lucide-react';

export default function PromoterRewardsPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rewards & Milestones</h1>
          <p className="text-neutral-500">Track your earnings and progress towards bonuses.</p>
        </div>
        <Button className="rounded-xl gap-2">
          <Wallet className="w-4 h-4" />
          Withdraw Rewards
        </Button>
      </div>

      {/* Rewards Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-3xl border-none shadow-sm">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center mb-4">
              <DollarSign className="w-6 h-6" />
            </div>
            <p className="text-sm text-neutral-500 font-medium">Total Earned</p>
            <h3 className="text-2xl font-bold mt-1">2,450 SAR</h3>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-none shadow-sm">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-sm text-neutral-500 font-medium">Pending</p>
            <h3 className="text-2xl font-bold mt-1">350 SAR</h3>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-none shadow-sm">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
              <Trophy className="w-6 h-6" />
            </div>
            <p className="text-sm text-neutral-500 font-medium">Milestones Reached</p>
            <h3 className="text-2xl font-bold mt-1">4</h3>
          </CardContent>
        </Card>
        <Card className="rounded-3xl border-none shadow-sm">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4">
              <Gift className="w-6 h-6" />
            </div>
            <p className="text-sm text-neutral-500 font-medium">Next Bonus</p>
            <h3 className="text-2xl font-bold mt-1">500 SAR</h3>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Reward History */}
        <Card className="lg:col-span-2 rounded-3xl border-none shadow-sm">
          <CardHeader>
            <CardTitle>Reward History</CardTitle>
            <CardDescription>Detailed log of your earned rewards.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { id: 'r1', type: 'Referral Bonus', doctor: 'Dr. Ahmed Zaki', amount: '200 SAR', date: '2024-04-05', status: 'Paid' },
                { id: 'r2', type: 'Milestone Bonus', doctor: '10 Doctors Reached', amount: '1,000 SAR', date: '2024-03-28', status: 'Paid' },
                { id: 'r3', type: 'Referral Bonus', doctor: 'Dr. Mona Ibrahim', amount: '200 SAR', date: '2024-03-25', status: 'Paid' },
                { id: 'r4', type: 'Referral Bonus', doctor: 'Dr. Yousef Ali', amount: '200 SAR', date: 'Pending', status: 'Pending' },
              ].map((reward) => (
                <div key={reward.id} className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center 
                      ${reward.status === 'Paid' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                      {reward.status === 'Paid' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{reward.type}</p>
                      <p className="text-xs text-neutral-500">{reward.doctor} • {reward.date}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">{reward.amount}</p>
                    <Badge variant={reward.status === 'Paid' ? 'default' : 'secondary'} className="rounded-lg text-[10px] h-5">
                      {reward.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Active Milestones */}
        <Card className="rounded-3xl border-none shadow-sm">
          <CardHeader>
            <CardTitle>Active Milestones</CardTitle>
            <CardDescription>Complete these to earn extra bonuses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Add 15 Doctors</span>
                <span className="text-xs font-bold text-primary">12/15</span>
              </div>
              <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[80%]" />
              </div>
              <p className="text-[10px] text-neutral-500">Reward: 500 SAR Bonus</p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total 500 Bookings</span>
                <span className="text-xs font-bold text-primary">342/500</span>
              </div>
              <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[68%]" />
              </div>
              <p className="text-[10px] text-neutral-500">Reward: 1,000 SAR Bonus</p>
            </div>

            <div className="pt-4 border-t border-neutral-100">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-orange-50 border border-orange-100">
                <Gift className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="text-xs font-bold text-orange-800">Special Offer</p>
                  <p className="text-[10px] text-orange-700/70">Double rewards for every doctor added this weekend!</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
