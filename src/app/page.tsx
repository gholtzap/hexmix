import Home from "@/components/Home";
import { connection } from "next/server";
export const metadata = {
  title: "Hexmix — Choose colors on real designs",
};
export default async function Page() {
  await connection();
  return <Home />;
}
