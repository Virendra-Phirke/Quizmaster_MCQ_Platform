import { UserProfile } from '@clerk/clerk-react';

const UserProfilePage = () => {
  return (
    <div className="min-h-screen pt-8 pb-20 px-4 sm:px-8 bg-slate-900 flex items-start justify-center">
      <div className="w-full max-w-6xl">
        <UserProfile
          routing="path"
          path="/user"
          appearance={{
            variables: {
              colorPrimary: '#a855f7',
              colorBackground: '#1e293b',
              colorText: '#ffffff',
              colorInputBackground: '#334155',
              colorInputText: '#ffffff',
              colorNeutral: '#64748b',
            },
            elements: {
              rootBox: 'w-full',
              card: 'bg-slate-800 text-white shadow-xl border border-slate-700',
              navbar: 'bg-slate-900 border-b border-slate-700',
              navbarButton: 'text-gray-300 hover:bg-slate-800 hover:text-white',
              navbarMobileMenuButton: 'text-white',
              profileSection: 'bg-slate-800',
              profileSectionTitle: 'text-white font-semibold',
              profileSectionContent: 'text-gray-300',
              profileSectionPrimaryButton: 'bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white',
              formFieldLabel: 'text-gray-200',
              formFieldInput: 'bg-slate-700 text-white border-slate-600 focus:border-slate-500',
              formFieldInputShowPasswordButton: 'text-gray-400 hover:text-white',
              formButtonPrimary: 'bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white',
              formButtonReset: 'text-gray-400 hover:text-white hover:bg-slate-700',
              badge: 'bg-blue-900 text-blue-200',
              avatarBox: 'border-2 border-slate-600',
              accordionTriggerButton: 'text-gray-200 hover:bg-slate-700',
              accordionContent: 'bg-slate-800',
              modalBackdrop: 'bg-black/70',
              modalContent: 'bg-slate-800 text-white border border-slate-700',
              modalCloseButton: 'text-gray-400 hover:text-white',
              page: 'bg-slate-800',
              pageScrollBox: 'bg-slate-800',
              breadcrumbs: 'text-gray-400',
              breadcrumbsItem: 'text-gray-400',
              breadcrumbsItemDivider: 'text-gray-600',
              dividerLine: 'bg-slate-700',
              dividerText: 'text-gray-400',
            }
          }}
        />
      </div>
    </div>
  );
};

export default UserProfilePage;
