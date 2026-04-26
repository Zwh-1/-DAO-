import { permanentRedirect } from "next/navigation";

export default function Redirect() {
  permanentRedirect("/arbitration/cases");
}
