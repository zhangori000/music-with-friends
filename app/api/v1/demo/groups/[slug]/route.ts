import { getDemoDashboard } from "@/src/application/demo/get-demo-dashboard";
import { rangePresetSchema } from "@/src/contracts/dashboard";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  if (slug !== "friday-loop") {
    return Response.json(
      { error: { code: "group_not_found", message: "Group not found." } },
      { status: 404 },
    );
  }

  const requestedRange = new URL(request.url).searchParams.get("range") ?? "this_week";
  const range = rangePresetSchema.safeParse(requestedRange);
  if (!range.success) {
    return Response.json(
      {
        error: {
          code: "invalid_range",
          message: `Unsupported range: ${requestedRange}`,
        },
      },
      { status: 400 },
    );
  }

  return Response.json(getDemoDashboard(range.data), {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "x-content-type-options": "nosniff",
    },
  });
}
