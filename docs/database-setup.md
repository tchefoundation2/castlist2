# 🗄️ Database Setup Guide

Para que o aplicativo funcione completamente com dados reais, você precisa configurar as tabelas no Supabase.

## 📋 **Pré-requisitos**

1. **Conta no Supabase**: [supabase.com](https://supabase.com)
2. **Projeto criado** no Supabase
3. **Variáveis de ambiente** configuradas no `.env`

## 🚀 **Scripts SQL para executar**

Execute os seguintes scripts **na ordem** no **SQL Editor** do Supabase:

### **1. Criar tabela de perfis**

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fid INTEGER UNIQUE NOT NULL,
    username TEXT NOT NULL,
    pfp_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read all profiles" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (fid = current_setting('app.current_user_fid')::INTEGER);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (true);
```

### **2. Criar tabelas de guias e livros**

```sql
-- Create books table
CREATE TABLE IF NOT EXISTS public.books (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    notes TEXT,
    cover_url TEXT,
    purchase_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create guides table
CREATE TABLE IF NOT EXISTS public.guides (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    tags TEXT[],
    is_public BOOLEAN DEFAULT true,
    creator_fid INTEGER NOT NULL REFERENCES public.profiles(fid),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create guide_books junction table
CREATE TABLE IF NOT EXISTS public.guide_books (
    id SERIAL PRIMARY KEY,
    guide_id INTEGER NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
    book_id INTEGER NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guide_id, book_id)
);

-- Enable RLS
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_books ENABLE ROW LEVEL SECURITY;

-- Books policies
CREATE POLICY "Anyone can read books" ON public.books
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create books" ON public.books
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update books" ON public.books
    FOR UPDATE USING (true);

-- Guides policies
CREATE POLICY "Anyone can read public guides" ON public.guides
    FOR SELECT USING (is_public = true OR creator_fid = current_setting('app.current_user_fid')::INTEGER);

CREATE POLICY "Users can create guides" ON public.guides
    FOR INSERT WITH CHECK (creator_fid = current_setting('app.current_user_fid')::INTEGER);

CREATE POLICY "Users can update own guides" ON public.guides
    FOR UPDATE USING (creator_fid = current_setting('app.current_user_fid')::INTEGER);

CREATE POLICY "Users can delete own guides" ON public.guides
    FOR DELETE USING (creator_fid = current_setting('app.current_user_fid')::INTEGER);

-- Guide_books policies
CREATE POLICY "Anyone can read guide_books" ON public.guide_books
    FOR SELECT USING (true);

CREATE POLICY "Users can manage guide_books" ON public.guide_books
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.guides 
            WHERE guides.id = guide_books.guide_id 
            AND guides.creator_fid = current_setting('app.current_user_fid')::INTEGER
        )
    );
```

### **3. Criar tabelas de interações**

```sql
-- Create guide_likes table
CREATE TABLE IF NOT EXISTS public.guide_likes (
    id SERIAL PRIMARY KEY,
    guide_id INTEGER NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
    user_fid INTEGER NOT NULL REFERENCES public.profiles(fid),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(guide_id, user_fid)
);

-- Create activities table
CREATE TABLE IF NOT EXISTS public.activities (
    id SERIAL PRIMARY KEY,
    user_fid INTEGER NOT NULL REFERENCES public.profiles(fid),
    action TEXT NOT NULL,
    item_title TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.guide_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Guide_likes policies
CREATE POLICY "Anyone can read guide_likes" ON public.guide_likes
    FOR SELECT USING (true);

CREATE POLICY "Users can manage own likes" ON public.guide_likes
    FOR ALL USING (user_fid = current_setting('app.current_user_fid')::INTEGER);

-- Activities policies
CREATE POLICY "Users can read own activities" ON public.activities
    FOR SELECT USING (user_fid = current_setting('app.current_user_fid')::INTEGER);

CREATE POLICY "Users can create own activities" ON public.activities
    FOR INSERT WITH CHECK (user_fid = current_setting('app.current_user_fid')::INTEGER);
```

### **4. Criar função auxiliar**

```sql
-- Function to set current user context
CREATE OR REPLACE FUNCTION public.set_current_user_fid(user_fid INTEGER)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_fid', user_fid::TEXT, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.set_current_user_fid(INTEGER) TO anon, authenticated;
```

### **5. Dados de exemplo (opcional)**

```sql
-- Insert sample data for testing
INSERT INTO public.profiles (fid, username, pfp_url) VALUES
(1, 'farcaster.eth', 'https://i.imgur.com/34Iodlt.jpg'),
(2, 'sci-fi-reader', 'https://i.imgur.com/PC3e8NJ.jpg'),
(3, 'bookworm', 'https://i.imgur.com/J3G59bK.jpg')
ON CONFLICT (fid) DO NOTHING;

-- Insert sample books
INSERT INTO public.books (title, author, notes, cover_url) VALUES
('Dune', 'Frank Herbert', 'Epic sci-fi masterpiece', 'https://i.imgur.com/sBwQ4yL.jpg'),
('Foundation', 'Isaac Asimov', 'Classic space opera', 'https://i.imgur.com/s4n7vVv.jpg'),
('The Name of the Wind', 'Patrick Rothfuss', 'Fantasy adventure', null)
ON CONFLICT DO NOTHING;

-- Insert sample guide
INSERT INTO public.guides (title, description, tags, creator_fid) VALUES
('Essential Sci-Fi Classics', 'A journey through the golden age of science fiction', ARRAY['sci-fi', 'classic'], 1)
ON CONFLICT DO NOTHING;

-- Link books to guide (adjust IDs as needed)
INSERT INTO public.guide_books (guide_id, book_id) VALUES
(1, 1), (1, 2)
ON CONFLICT DO NOTHING;
```

## ✅ **Verificação**

Após executar os scripts, verifique se tudo está funcionando:

```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check sample data
SELECT p.username, g.title, COUNT(gb.book_id) as book_count
FROM profiles p
JOIN guides g ON p.fid = g.creator_fid
LEFT JOIN guide_books gb ON g.id = gb.guide_id
GROUP BY p.username, g.title;
```

## 🔧 **Configuração do .env**

Certifique-se de que seu arquivo `.env` está configurado:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima
```

## 🎉 **Pronto!**

Agora seu aplicativo está conectado a uma base de dados real no Supabase! 

- ✅ **Perfis de usuário** sincronizados com Farcaster
- ✅ **Guias e livros** armazenados no banco
- ✅ **Sistema de likes** funcional
- ✅ **Log de atividades** implementado
- ✅ **Segurança RLS** configurada

O aplicativo agora funciona com dados reais em vez de dados mock! 🚀