import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const numericId = id
    ? id.includes("/")
      ? id.split("/").pop()
      : id
    : null;

  return { id: numericId };
};

export default function EditRedirect() {
  const { id } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) {
      navigate(`/app/${id}`, { replace: true });
    } else {
      navigate("/app", { replace: true });
    }
  }, [id, navigate]);

  return null;
}
