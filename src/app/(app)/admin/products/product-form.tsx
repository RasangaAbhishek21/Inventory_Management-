"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { PrimaryAction } from "@/components/ui/PrimaryAction";
import { Field, fieldInputClass } from "@/components/ui/Field";
import { config } from "@/config";
import { t } from "@/strings";
import type { Role } from "@/types/database";
import { createProduct, updateProduct, updateStandardCost } from "./actions";

interface ProductRow {
  id: string;
  name: string;
  category_id: string | null;
  selling_price: number;
  standard_cost: number | null;
  image_path: string | null;
}

export function ProductForm({
  product,
  categories,
  role,
  imageBaseUrl,
}: {
  product?: ProductRow;
  categories: { id: string; name: string }[];
  role: Role;
  imageBaseUrl: string;
}) {
  const router = useRouter();
  const financeOnly = role === "finance";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    product?.image_path ? `${imageBaseUrl}/${product.image_path}` : null,
  );

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const { default: compress } = await import("browser-image-compression");
      const out = await compress(f, {
        maxSizeMB: 1.5,
        maxWidthOrHeight: 1400,
        fileType: "image/webp",
      });
      if (out.size > config.MAX_IMAGE_BYTES) {
        setError(t.admin.imageTooLarge);
        setFile(null);
      } else {
        setFile(out);
        setPreview(URL.createObjectURL(out));
      }
    } catch {
      setError(t.admin.imageTooLarge);
    }
    setBusy(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);

      if (financeOnly && product) {
        await updateStandardCost(product.id, fd);
        toast.success(t.confirmations.saved(product.name));
        router.push("/admin/products");
        router.refresh();
        return;
      }

      if (file) {
        const supabase = createClient();
        const path = `products/${crypto.randomUUID()}.webp`;
        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(path, file, { contentType: "image/webp", upsert: false });
        if (upErr) throw new Error(upErr.message);
        fd.set("image_path", path);
      } else if (product?.image_path) {
        fd.set("image_path", product.image_path);
      }

      if (product) {
        await updateProduct(product.id, fd);
      } else {
        await createProduct(fd);
      }
      toast.success(t.confirmations.saved(String(fd.get("name") ?? t.admin.products)));
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (financeOnly && product) {
    return (
      <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
        <p className="text-sm text-ink-60">{t.admin.financeCanOnlyEditCost}</p>
        <div>
          <span className="text-sm font-medium">{t.admin.name}</span>
          <p className="text-base">{product.name}</p>
        </div>
        <Field label={t.admin.standardCost}>
          <input
            name="standard_cost"
            type="number"
            step="0.01"
            min={0}
            defaultValue={product.standard_cost ?? ""}
            className={fieldInputClass}
          />
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <PrimaryAction type="submit" disabled={busy}>
          {t.common.save}
        </PrimaryAction>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      <Field label={t.admin.name}>
        <input name="name" required defaultValue={product?.name ?? ""} className={fieldInputClass} />
      </Field>

      <Field label={t.admin.category} optional>
        <select
          name="category_id"
          defaultValue={product?.category_id ?? ""}
          className={fieldInputClass}
        >
          <option value="">{t.admin.none}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label={t.admin.sellingPrice}>
        <input
          name="selling_price"
          type="number"
          step="0.01"
          min={0}
          required
          defaultValue={product?.selling_price ?? ""}
          className={fieldInputClass}
        />
      </Field>

      <Field label={t.admin.standardCost} optional>
        <input
          name="standard_cost"
          type="number"
          step="0.01"
          min={0}
          defaultValue={product?.standard_cost ?? ""}
          className={fieldInputClass}
        />
      </Field>

      <Field label={t.admin.image} optional hint="Compressed on your phone; 2 MB max.">
        <input type="file" accept="image/*" onChange={pickImage} className="text-sm" />
      </Field>
      {busy && !error ? <p className="text-sm text-ink-60">{t.admin.compressing}</p> : null}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-32 w-32 rounded-lg object-cover" />
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <PrimaryAction type="submit" disabled={busy}>
        {t.common.save}
      </PrimaryAction>
    </form>
  );
}
