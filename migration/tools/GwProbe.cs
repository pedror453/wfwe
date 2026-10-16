// GwProbe: Copymax-only probe through V81.COMConnector (x86, STA). Prints no personal data.
// Build: csc /nologo /platform:x86 /codepage:65001 /r:System.Security.dll /out:GwProbe.exe GwProbe.cs
// Usage: GwProbe.exe facts | compile | catlist | catstruct <Name1,Name2,...>
using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

public static class GwProbe
{
    const string Srvr = "LR";
    const string Ref = "Copymax"; // the only infobase this tool may open
    const string Root = @"C:\Base_1C\MCP_LR_Copy_20261016";
    static object ib;
    static string user = "", pwd = "", uc = "";
    static string scratchIb = null, outCsv = null;
    const string DefaultCats = "Организации,Контрагенты,Автомобили,Сотрудники,Номенклатура,Автоработы,ВидыРемонта,Цеха,Нормочасы,Проекты,ДоговорыВзаиморасчетов,Валюты,ЕдиницыИзмерения,СтавкиНДС";

    static object GP(object o, string n) { return o.GetType().InvokeMember(n, BindingFlags.GetProperty, null, o, null); }
    static void SP(object o, string n, object v) { o.GetType().InvokeMember(n, BindingFlags.SetProperty, null, o, new object[] { v }); }
    static object CM(object o, string n, params object[] a) { return o.GetType().InvokeMember(n, BindingFlags.InvokeMethod, null, o, a); }
    static string Mask(string s)
    {
        if (s == null) return "";
        if (pwd.Length > 0) s = s.Replace(pwd, "***");
        if (uc.Length > 0) s = s.Replace(uc, "***");
        return s;
    }
    static string Err(Exception e) { Exception x = e; while (x.InnerException != null) x = x.InnerException; return Mask(x.Message); }
    static string Try(Func<object> f) { try { object v = f(); return v == null ? "" : Convert.ToString(v); } catch (Exception e) { return "<ERR: " + Err(e) + ">"; } }

    static List<object> Items(object coll)
    {
        var res = new List<object>();
        if (coll == null) return res;
        try { IEnumerable en = coll as IEnumerable; if (en != null) { foreach (object x in en) res.Add(x); } } catch (Exception) { }
        if (res.Count == 0)
        {
            try { int n = Convert.ToInt32(CM(coll, "Количество")); for (int i = 0; i < n; i++) res.Add(CM(coll, "Получить", i)); } catch (Exception) { }
        }
        return res;
    }

    static long Connect()
    {
        var sw = Stopwatch.StartNew();
        if (scratchIb != null)
        {
            string allowed = Path.Combine(Root, @"agent_work\scratch83");
            if (!Path.GetFullPath(scratchIb).StartsWith(allowed, StringComparison.OrdinalIgnoreCase)) throw new Exception("Only scratch infobases are allowed.");
            object c0 = Activator.CreateInstance(Type.GetTypeFromProgID("V81.COMConnector"));
            ib = CM(c0, "Connect", "File=\"" + scratchIb + "\"");
            return sw.ElapsedMilliseconds;
        }
        user = File.ReadAllText(Path.Combine(Root, @"agent_work\secrets\copymax.user"), Encoding.UTF8).Trim();
        string hex = File.ReadAllText(Path.Combine(Root, @"agent_work\secrets\copymax.pass.dpapi"), Encoding.ASCII).Trim();
        byte[] blob = new byte[hex.Length / 2];
        for (int i = 0; i < blob.Length; i++) blob[i] = Convert.ToByte(hex.Substring(i * 2, 2), 16);
        pwd = Encoding.Unicode.GetString(ProtectedData.Unprotect(blob, null, DataProtectionScope.CurrentUser));
        string bat = File.ReadAllText(Path.Combine(Root, "Open_Copymax_1C.bat"), Encoding.Default);
        Match m = Regex.Match(bat, "/UC\"?([^\"\\s]+)\"?");
        uc = m.Success ? m.Groups[1].Value : "";
        string cs = "Srvr=\"" + Srvr + "\";Ref=\"" + Ref + "\";Usr=\"" + user + "\";Pwd=\"" + pwd + "\"";
        if (uc.Length > 0) cs += ";UC=\"" + uc + "\"";
        object conn = Activator.CreateInstance(Type.GetTypeFromProgID("V81.COMConnector"));
        ib = CM(conn, "Connect", cs);
        return sw.ElapsedMilliseconds;
    }

    static object Query(string text, params object[] nv)
    {
        object q = CM(ib, "NewObject", "Запрос");
        SP(q, "Текст", text);
        for (int i = 0; i + 1 < nv.Length; i += 2) CM(q, "УстановитьПараметр", nv[i], nv[i + 1]);
        return CM(CM(q, "Выполнить"), "Выгрузить");
    }
    static string Cell(object vt, int row, string col) { return Try(() => GP(CM(vt, "Получить", row), col)); }
    static void Cnt(string label, string text)
    {
        var sw = Stopwatch.StartNew();
        try { object vt = Query(text); Console.WriteLine(label + " = " + Cell(vt, 0, "Н") + " (" + sw.ElapsedMilliseconds + " ms)"); }
        catch (Exception e) { Console.WriteLine(label + ": " + Err(e)); }
    }

    static void Facts()
    {
        long ms = Connect();
        Console.WriteLine("connected to " + Srvr + "\\" + Ref + " in " + ms + " ms");
        object md = GP(ib, "Метаданные");
        Console.WriteLine("platform=" + Try(() => GP(CM(ib, "NewObject", "СистемнаяИнформация"), "ВерсияПриложения")));
        Console.WriteLine("config=" + Try(() => GP(md, "Имя")) + " version=" + Try(() => GP(md, "Версия")));
        try
        {
            object iu = GP(ib, "ПользователиИнформационнойБазы");
            object cu = CM(iu, "ТекущийПользователь");
            Console.WriteLine("current user=" + Try(() => GP(cu, "Имя")));
            var roles = new List<string>();
            foreach (object r in Items(GP(cu, "Роли"))) roles.Add(Try(() => GP(r, "Имя")));
            Console.WriteLine("roles(" + roles.Count + ")=" + string.Join(",", roles.ToArray()));
            Console.WriteLine("infobase users=" + Try(() => CM(CM(iu, "ПолучитьПользователей"), "Количество")));
        }
        catch (Exception e) { Console.WriteLine("users: " + Err(e)); }
        try
        {
            object jobs = CM(GP(ib, "РегламентныеЗадания"), "ПолучитьРегламентныеЗадания");
            int on = 0, all = 0; var names = new List<string>();
            foreach (object j in Items(jobs))
            {
                all++;
                if (Try(() => GP(j, "Использование")) == "True") { on++; names.Add(Try(() => GP(GP(j, "Метаданные"), "Имя"))); }
            }
            Console.WriteLine("scheduled jobs total=" + all + " enabled=" + on + (on > 0 ? " (" + string.Join(",", names.ToArray()) + ")" : ""));
        }
        catch (Exception e) { Console.WriteLine("scheduled jobs: " + Err(e)); }
        Cnt("work orders total", "ВЫБРАТЬ КОЛИЧЕСТВО(*) КАК Н ИЗ Документ.ЗаказНаряд КАК Т");
        Cnt("work orders posted", "ВЫБРАТЬ КОЛИЧЕСТВО(*) КАК Н ИЗ Документ.ЗаказНаряд КАК Т ГДЕ Т.Проведен");
        Cnt("work orders max date", "ВЫБРАТЬ МАКСИМУМ(Т.Дата) КАК Н ИЗ Документ.ЗаказНаряд КАК Т");
        Cnt("work orders min date", "ВЫБРАТЬ МИНИМУМ(Т.Дата) КАК Н ИЗ Документ.ЗаказНаряд КАК Т");
        Cnt("counterparties", "ВЫБРАТЬ КОЛИЧЕСТВО(*) КАК Н ИЗ Справочник.Контрагенты КАК Т");
        Cnt("cars", "ВЫБРАТЬ КОЛИЧЕСТВО(*) КАК Н ИЗ Справочник.Автомобили КАК Т");
        Cnt("nomenclature", "ВЫБРАТЬ КОЛИЧЕСТВО(*) КАК Н ИЗ Справочник.Номенклатура КАК Т");
        Cnt("employees", "ВЫБРАТЬ КОЛИЧЕСТВО(*) КАК Н ИЗ Справочник.Сотрудники КАК Т");
        try
        {
            object vt = Query("ВЫБРАТЬ ПРЕДСТАВЛЕНИЕ(Т.Состояние) КАК С, КОЛИЧЕСТВО(*) КАК К ИЗ Документ.ЗаказНаряд КАК Т СГРУППИРОВАТЬ ПО Т.Состояние");
            int n = Convert.ToInt32(CM(vt, "Количество"));
            for (int i = 0; i < n; i++) Console.WriteLine("  state '" + Cell(vt, i, "С") + "' = " + Cell(vt, i, "К"));
        }
        catch (Exception e) { Console.WriteLine("states: " + Err(e)); }
    }

    static void Compile()
    {
        long ms = Connect();
        Console.WriteLine("connected in " + ms + " ms; creating objects in memory only");
        string csv = outCsv != null ? outCsv : Path.Combine(Root, @"agent_work\audit\compile_matrix.csv");
        File.WriteAllText(csv, "kind;name;time;result\r\n", new UTF8Encoding(true));
        object md = GP(ib, "Метаданные");
        string[][] specs = new string[][] { new string[] { "Документы", "СоздатьДокумент" }, new string[] { "Справочники", "СоздатьЭлемент" } };
        foreach (string[] spec in specs)
        {
            var names = new List<string>();
            foreach (object o in Items(GP(md, spec[0]))) names.Add(Try(() => GP(o, "Имя")));
            object mgrs = GP(ib, spec[0]);
            foreach (string name in names)
            {
                string res;
                var sw = Stopwatch.StartNew();
                try { object m = GP(mgrs, name); CM(m, spec[1]); res = "OK"; }
                catch (Exception e) { res = "ERR: " + Err(e); }
                File.AppendAllText(csv, spec[0] + ";" + name + ";" + sw.ElapsedMilliseconds + "ms;" + res.Replace(";", ",").Replace("\r", " ").Replace("\n", " ") + "\r\n", Encoding.UTF8);
            }
        }
        File.AppendAllText(csv, "DONE\r\n", Encoding.UTF8);
        Console.WriteLine("compile matrix written");
    }

    static void CatList()
    {
        Connect();
        object md = GP(ib, "Метаданные");
        var lines = new List<string>();
        foreach (object o in Items(GP(md, "Справочники")))
            lines.Add(Try(() => GP(o, "Имя")) + "|" + Try(() => GP(o, "Синоним")) + "|hier=" + Try(() => GP(o, "Иерархический")) + "|codeLen=" + Try(() => GP(o, "ДлинаКода")) + "|descrLen=" + Try(() => GP(o, "ДлинаНаименования")));
        File.WriteAllLines(Path.Combine(Root, @"agent_work\audit\catalog_list.txt"), lines.ToArray(), new UTF8Encoding(true));
        Console.WriteLine("catalogs listed: " + lines.Count);
    }

    static string TypeStr(object a) { return Try(() => CM(ib, "String", GP(a, "Тип"))); }

    static void CatStruct(string names)
    {
        Connect();
        object md = GP(ib, "Метаданные");
        var lines = new List<string>();
        List<object> all = Items(GP(md, "Справочники"));
        foreach (string name in names.Split(','))
        {
            object found = null;
            foreach (object o in all) { if (Try(() => GP(o, "Имя")) == name) { found = o; break; } }
            if (found == null) { lines.Add("NOT FOUND: " + name); continue; }
            lines.Add("CATALOG " + name + " | " + Try(() => GP(found, "Синоним")) + " | hier=" + Try(() => GP(found, "Иерархический")) + " | codeLen=" + Try(() => GP(found, "ДлинаКода")) + " | descrLen=" + Try(() => GP(found, "ДлинаНаименования")));
            foreach (object a in Items(GP(found, "Реквизиты"))) lines.Add("   " + Try(() => GP(a, "Имя")) + " : " + TypeStr(a) + " | " + Try(() => GP(a, "Синоним")));
        }
        File.WriteAllLines(Path.Combine(Root, @"agent_work\audit\catalog_struct.txt"), lines.ToArray(), new UTF8Encoding(true));
        Console.WriteLine("structure lines: " + lines.Count);
    }

    static List<object> AsList(object o)
    {
        var r = new List<object>();
        Array a = o as Array;
        if (a != null) { foreach (object x in a) r.Add(x); }
        return r;
    }

    // Cluster administration API (read-only): sessions of the Copymax work copy; other infobases are only counted.
    static void Sessions()
    {
        object conn = Activator.CreateInstance(Type.GetTypeFromProgID("V81.COMConnector"));
        object agent = CM(conn, "ConnectAgent", "tcp://" + Srvr + ":1540");
        Console.WriteLine("agent connected");
        foreach (object cl in AsList(CM(agent, "GetClusters")))
        {
            Console.WriteLine("cluster: " + Try(() => GP(cl, "ClusterName")));
            Console.WriteLine("authenticate: " + Try(() => CM(agent, "Authenticate", cl, "", "")));
            int others = 0;
            foreach (object s in AsList(CM(agent, "GetSessions", cl)))
            {
                string ibn = "?";
                try { ibn = Convert.ToString(GP(GP(s, "InfoBase"), "Name")); } catch (Exception) { }
                if (!string.Equals(ibn, Ref, StringComparison.OrdinalIgnoreCase)) { others++; continue; }
                Console.WriteLine("Copymax session id=" + Try(() => GP(s, "SessionID")) + " user=" + Try(() => GP(s, "UserName")) + " app=" + Try(() => GP(s, "AppID")) + " started=" + Try(() => GP(s, "StartedAt")) + " lastActive=" + Try(() => GP(s, "LastActiveAt")) + " host=" + Try(() => GP(s, "Host")));
            }
            Console.WriteLine("sessions on other infobases: " + others);
        }
    }

    [STAThread]
    public static int Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        var list = new List<string>();
        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--ib" && i + 1 < args.Length) scratchIb = args[++i];
            else if (args[i] == "--out" && i + 1 < args.Length) outCsv = args[++i];
            else list.Add(args[i]);
        }
        args = list.ToArray();
        string mode = args.Length > 0 ? args[0] : "facts";
        try
        {
            if (mode == "sessions") Sessions();
            else if (mode == "compile") Compile();
            else if (mode == "catlist") CatList();
            else if (mode == "catstruct") CatStruct(args.Length > 1 && args[1] != "default" ? args[1] : DefaultCats);
            else Facts();
        }
        catch (Exception e) { Console.WriteLine("FATAL: " + Err(e)); return 1; }
        return 0;
    }
}
