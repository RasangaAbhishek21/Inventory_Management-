-- 0020_storage
-- Product images bucket (brief §8.11): public read, authenticated write restricted to
-- ops_manager / admin. Client compresses and caps at 2 MB before upload; the object
-- path is stored in products.image_path.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152,
        array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "product images are public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "ops and admin write product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth_role() in ('ops_manager', 'admin'));

create policy "ops and admin update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and auth_role() in ('ops_manager', 'admin'));

create policy "ops and admin delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and auth_role() in ('ops_manager', 'admin'));
