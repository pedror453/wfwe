using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using System.Runtime.InteropServices;

namespace Kermo.Gateway
{
    /// <summary>Пізнє зв'язування COM-об'єктів 1С 8.1 (типізованої бібліотеки типів у них немає).</summary>
    public static class Late
    {
        public static object Get(object o, string n) { return o.GetType().InvokeMember(n, BindingFlags.GetProperty, null, o, null); }
        public static void Set(object o, string n, object v) { o.GetType().InvokeMember(n, BindingFlags.SetProperty, null, o, new object[] { v }); }
        public static object Call(object o, string n, params object[] a) { return o.GetType().InvokeMember(n, BindingFlags.InvokeMethod, null, o, a); }

        public static string Err(Exception e)
        {
            Exception x = e;
            while (x.InnerException != null) x = x.InnerException;
            return x.Message;
        }

        public static List<object> Items(object coll)
        {
            var res = new List<object>();
            if (coll == null) return res;
            try { IEnumerable en = coll as IEnumerable; if (en != null) { foreach (object x in en) res.Add(x); } } catch (Exception) { }
            if (res.Count == 0)
            {
                try { int n = Convert.ToInt32(Call(coll, "Количество")); for (int i = 0; i < n; i++) res.Add(Call(coll, "Получить", i)); } catch (Exception) { }
            }
            return res;
        }
    }

    /// <summary>Одне з'єднання з 1С (COM, x86). Використовувати лише з потоку, що його створив (STA).</summary>
    public sealed class OneC : IDisposable
    {
        object ib;
        readonly Dictionary<string, object> stateRefs = new Dictionary<string, object>();
        readonly Dictionary<string, bool> hier = new Dictionary<string, bool>();
        public string User = "";
        public string Platform = "";
        public List<string> Roles = new List<string>();

        static string Esc(string s) { return (s ?? "").Replace("\"", "\"\""); }

        public static OneC Connect(GatewayConfig cfg, string user, string password)
        {
            string cs = "Srvr=\"" + Esc(cfg.Srvr) + "\";Ref=\"" + Esc(cfg.Ref) + "\";Usr=\"" + Esc(user) + "\";Pwd=\"" + Esc(password) + "\"";
            if (!string.IsNullOrEmpty(cfg.PermissionCode)) cs += ";UC=\"" + Esc(cfg.PermissionCode) + "\"";
            object conn = Activator.CreateInstance(Type.GetTypeFromProgID("V81.COMConnector"));
            var o = new OneC();
            o.ib = Late.Call(conn, "Connect", cs);
            o.User = user;
            try { o.Platform = Convert.ToString(Late.Get(Late.Call(o.ib, "NewObject", "СистемнаяИнформация"), "ВерсияПриложения")); } catch (Exception) { }
            try
            {
                object cu = Late.Call(Late.Get(o.ib, "ПользователиИнформационнойБазы"), "ТекущийПользователь");
                foreach (object r in Late.Items(Late.Get(cu, "Роли"))) o.Roles.Add(Convert.ToString(Late.Get(r, "Имя")));
            }
            catch (Exception) { }
            return o;
        }

        public void Dispose()
        {
            try { if (ib != null) { while (Marshal.ReleaseComObject(ib) > 0) { } } } catch (Exception) { }
            ib = null;
            GC.Collect();
            GC.WaitForPendingFinalizers();
        }

        public object Raw { get { return ib; } }

        public string Str(object v) { return Convert.ToString(Late.Call(ib, "String", v)); }

        public object NewObject(string type, params object[] args)
        {
            var a = new object[args.Length + 1];
            a[0] = type;
            Array.Copy(args, 0, a, 1, args.Length);
            return Late.Call(ib, "NewObject", a);
        }

        public string IdOf(object r)
        {
            try { return Convert.ToString(Late.Call(ib, "String", Late.Call(r, "УникальныйИдентификатор"))); } catch (Exception) { return ""; }
        }

        public Dictionary<string, object> RefOf(object r)
        {
            try { if (Convert.ToBoolean(Late.Call(r, "Пустая"))) return null; } catch (Exception) { }
            string name = "";
            try { name = Str(r); } catch (Exception) { }
            return new Dictionary<string, object> { { "id", IdOf(r) }, { "name", name } };
        }

        public object Conv(object v, bool idOnly)
        {
            if (v == null || v is string || v is bool) return v;
            if (v is DateTime)
            {
                var d = (DateTime)v;
                return d.Year < 1900 ? null : (object)d.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture);
            }
            if (v is IConvertible)
            {
                try { return Convert.ToDouble(v, CultureInfo.InvariantCulture); } catch (Exception) { return Convert.ToString(v, CultureInfo.InvariantCulture); }
            }
            return idOnly ? (object)IdOf(v) : RefOf(v);
        }

        /// <summary>Виконує запит 1С і повертає рядки; колонки перелічені явно, щоб не робити зайвих COM-викликів.</summary>
        public List<Dictionary<string, object>> Query(string text, string[] cols, string[] idOnly, params object[] nameValue)
        {
            object q = NewObject("Запрос");
            Late.Set(q, "Текст", text);
            for (int i = 0; i + 1 < nameValue.Length; i += 2) Late.Call(q, "УстановитьПараметр", nameValue[i], nameValue[i + 1]);
            object vt = Late.Call(Late.Call(q, "Выполнить"), "Выгрузить");
            int n = Convert.ToInt32(Late.Call(vt, "Количество"));
            var only = new HashSet<string>(idOnly ?? new string[0]);
            var rows = new List<Dictionary<string, object>>(n);
            for (int i = 0; i < n; i++)
            {
                object row = Late.Call(vt, "Получить", i);
                var d = new Dictionary<string, object>();
                foreach (string c in cols) d[c] = Conv(Late.Get(row, c), only.Contains(c));
                rows.Add(d);
            }
            return rows;
        }

        public List<Dictionary<string, object>> Query(string text, string[] cols, params object[] nameValue)
        {
            return Query(text, cols, null, nameValue);
        }

        /// <summary>Посилання на значення переліку «Стан» за його назвою (береться з даних, бо ім'я переліку в метаданих невідоме).</summary>
        public object StateRef(string presentation)
        {
            if (stateRefs.Count == 0)
            {
                object q = NewObject("Запрос");
                Late.Set(q, "Текст", "ВЫБРАТЬ РАЗЛИЧНЫЕ Т.Состояние КАК С, ПРЕДСТАВЛЕНИЕ(Т.Состояние) КАК Н ИЗ Документ.ЗаказНаряд КАК Т");
                object vt = Late.Call(Late.Call(q, "Выполнить"), "Выгрузить");
                int n = Convert.ToInt32(Late.Call(vt, "Количество"));
                for (int i = 0; i < n; i++)
                {
                    object row = Late.Call(vt, "Получить", i);
                    stateRefs[Convert.ToString(Late.Get(row, "Н"))] = Late.Get(row, "С");
                }
            }
            object r;
            return stateRefs.TryGetValue(presentation, out r) ? r : null;
        }

        public bool IsHierarchical(string catalog)
        {
            bool h;
            if (hier.TryGetValue(catalog, out h)) return h;
            h = false;
            foreach (object c in Late.Items(Late.Get(Late.Get(ib, "Метаданные"), "Справочники")))
            {
                if (Convert.ToString(Late.Get(c, "Имя")) == catalog)
                {
                    h = Convert.ToBoolean(Late.Get(c, "Иерархический"));
                    break;
                }
            }
            hier[catalog] = h;
            return h;
        }

        public object RefById(string manager, string name, string guid)
        {
            object uid = NewObject("УникальныйИдентификатор", guid);
            return Late.Call(Late.Get(Late.Get(ib, manager), name), "ПолучитьСсылку", uid);
        }
    }
}
