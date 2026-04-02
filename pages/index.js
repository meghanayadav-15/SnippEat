-- Add is_favourite column to recipes table
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS is_favourite boolean DEFAULT false;

-- Add category_ids column to recipes table  
ALTER TABLE recipes ADD COLUMN IF NOT EXISTS category_ids uuid[] DEFAULT '{}';

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text DEFAULT '🏷',
  color text DEFAULT '#e8401c',
  created_at timestamptz DEFAULT now()
);

-- Enable row level security on categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Allow users to only see and edit their own categories
CREATE POLICY "Users can manage their own categories" ON categories
  FOR ALL USING (auth.uid() = user_id);
