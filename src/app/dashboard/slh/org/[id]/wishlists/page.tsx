import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import {
  assignableShoppers,
  canOpenSlhOrg,
  slhOrg,
  wishListRows,
} from "@/lib/slh";
import {
  AGE_FILTERS,
  LIST_STATUS,
  listStatus,
  type ListStatus,
} from "@/lib/slh-admin";
import { ListFilters } from "@/components/slh/ListFilters";
import { WishListSummary } from "@/components/slh/WishListTable";
import { WishListBulk } from "@/components/slh/WishListBulk";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wish lists", robots: { index: false } };

/**
 * One organisation's wish lists.
 *
 * The same list as the Lighthouse one, scoped by `wishListRows` to what this
 * viewer may read — with the guardian's name shown, because this is the team
 * who nominated them and will be ringing them about an unfilled list.
 */
export default async function OrgWishListsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  if (!(await canOpenSlhOrg(id))) notFound();

  const org = await slhOrg(id);
  if (!org) notFound();

  const query = await searchParams;
  const one = (key: string) => {
    const value = query[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const status = one("status");
  const [all, shoppers] = await Promise.all([
    wishListRows({
      organisationId: id,
      gender: one("gender"),
      age: one("age"),
      search: one("q"),
    }),
    assignableShoppers(),
  ]);
  const rows = status ? all.filter((r) => listStatus(r) === status) : all;

  return (
    <div className="-m-4 min-h-full bg-white text-neutral-950 lg:-m-6">
      <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8">
        <Link
          href={`/dashboard/slh/org/${org.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {org.name}
        </Link>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">
          Wish lists
        </h1>
        <WishListSummary rows={rows} />

        <ListFilters
          search="Search a first name"
          menus={[
            {
              name: "status",
              label: "Any status",
              options: (Object.keys(LIST_STATUS) as ListStatus[]).map(
                (key) => ({
                  value: key,
                  label: LIST_STATUS[key].label,
                }),
              ),
            },
            {
              name: "age",
              label: "Any age",
              options: AGE_FILTERS.map(([value, label]) => ({ value, label })),
            },
            {
              name: "gender",
              label: "Girls and boys",
              options: [
                { value: "girl", label: "Girls" },
                { value: "boy", label: "Boys" },
              ],
            },
          ]}
        />

        <WishListBulk
          rows={rows}
          shoppers={shoppers}
          showOrganisation={false}
          showGuardian
          hrefFor={(row) => `/dashboard/slh/org/${org.id}/child/${row.id}`}
        />
      </div>
    </div>
  );
}
