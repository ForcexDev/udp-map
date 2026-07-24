import * as RadixTabs from '@radix-ui/react-tabs'

export const Tabs = {
  Root: RadixTabs.Root,
  List: ({ className = '', ...props }: RadixTabs.TabsListProps) => (
    <RadixTabs.List
      className={`flex gap-[26px] border-b border-neutral-200 dark:border-profile-line mb-6 px-[22px] ${className}`}
      {...props}
    />
  ),
  Trigger: ({ className = '', ...props }: RadixTabs.TabsTriggerProps) => (
    <RadixTabs.Trigger
      className={`pb-3 text-[13.5px] font-medium text-neutral-500 dark:text-profile-faint cursor-pointer border-b-2 border-transparent -mb-[1px] transition-colors duration-150 data-[state=active]:text-neutral-900 dark:data-[state=active]:text-profile-text data-[state=active]:border-[#D41F2D] dark:data-[state=active]:border-profile-accent hover:text-neutral-700 dark:hover:text-profile-muted outline-none focus-visible:ring-2 focus-visible:ring-[#D41F2D] dark:focus-visible:ring-profile-accent ${className}`}
      {...props}
    />
  ),
  Content: ({ className = '', ...props }: RadixTabs.TabsContentProps) => (
    <RadixTabs.Content
      className={`outline-none ${className}`}
      {...props}
    />
  ),
}
