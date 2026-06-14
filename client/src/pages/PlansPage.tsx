import { useQuery } from '@tanstack/react-query';
import { plansApi } from '@/lib/api';
import { formatBytes } from '@/lib/utils';
import { CreditCard, Loader2, Plus } from 'lucide-react';

export function PlansPage() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: () => plansApi.getAll().then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Plans</h1>
          <p className="text-sm text-gray-400 mt-1">Manage subscription plans</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium">
          <Plus size={16} /> Add Plan
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-purple-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans?.map((plan) => (
            <div key={plan.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{plan.description || `${plan.duration} days`}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">${plan.price}</div>
                  <div className="text-xs text-gray-500">{plan.currency} / {plan.duration}d</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Traffic</span><span className="text-gray-300">{plan.trafficLimit > 0 ? formatBytes(plan.trafficLimit) : 'Unlimited'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="text-gray-300">{plan.type}</span></div>
                {plan._count && <div className="flex justify-between"><span className="text-gray-500">Subscriptions</span><span className="text-gray-300">{plan._count.subscriptions}</span></div>}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-800 flex gap-2">
                <span className={`px-2 py-0.5 rounded-md text-xs ${plan.active ? 'bg-green-500/10 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                  {plan.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
