import { Fragment } from 'react'
import type { ReactElement } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@rhyme/ui/components/breadcrumb'

export interface WorkspaceCrumb {
  label: string
  link?: ReactElement
}

export function WorkspaceBreadcrumbs({ items }: { items: WorkspaceCrumb[] }) {
  return (
    <Breadcrumb className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap gap-2 overflow-x-auto whitespace-nowrap py-1">
        <BreadcrumbItem
          className={
            items.length > 1 ? 'hidden shrink-0 sm:inline-flex' : 'shrink-0'
          }
        >
          <BreadcrumbLink asChild>
            <Link to="/files" search={{ view: 'mine' }}>
              Workspace
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {items.map((item, index) => (
          <Fragment key={index}>
            <BreadcrumbSeparator
              className={
                items.length > 1 && index < items.length - 1
                  ? 'hidden sm:block'
                  : 'shrink-0'
              }
            />
            <BreadcrumbItem
              className={
                index < items.length - 2
                  ? 'hidden shrink-0 sm:inline-flex'
                  : 'min-w-0 shrink-0 last:shrink'
              }
            >
              {item.link ? (
                <BreadcrumbLink asChild>{item.link}</BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="truncate" title={item.label}>
                  {item.label}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
