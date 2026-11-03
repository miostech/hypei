import { UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAppDictionary } from "@/lib/i18n/app";
import { appLocale } from "@/lib/i18n/app/server";
import { fill } from "@/lib/i18n/locale";
import { formatDate } from "@/lib/ui/format";
import { requirePagePermission } from "@/modules/organizations/current-organization";
import { getServices } from "@/server/container";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getAppDictionary(await appLocale())).customers.title };
}

export default async function CustomersPage({ searchParams }: PageProps<"/customers">) {
  const { organization } = await requirePagePermission("customers:read");
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q : undefined;
  const customers = await getServices().uow.repos.customers.list(organization.id, { search, limit: 100 });
  const dict = await getAppDictionary(await appLocale());
  const t = dict.customers;

  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      <form className="max-w-sm">
        <Input name="q" defaultValue={search} placeholder={t.searchPlaceholder} aria-label={t.searchLabel} />
      </form>

      {customers.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title={search ? t.notFoundTitle : t.emptyTitle}
          description={search ? t.notFoundBody : t.emptyBody}
        />
      ) : (
        <Card className="py-0">
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.common.customer}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t.country}</TableHead>
                  <TableHead className="text-right">{t.orders}</TableHead>
                  <TableHead className="hidden md:table-cell">{t.since}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="max-w-[60vw] sm:max-w-none">
                      <span className="block truncate font-medium">{customer.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{customer.email}</span>
                      <span className="block text-xs text-muted-foreground md:hidden">
                        {fill(t.sinceDate, { date: formatDate(customer.createdAt, dict.localeTag) })}
                      </span>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">{customer.country ?? "—"}</TableCell>
                    <TableCell className="tabular text-right text-muted-foreground">{customer._count.orders}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {formatDate(customer.createdAt, dict.localeTag)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
