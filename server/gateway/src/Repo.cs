using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Kermo.Gateway
{
    /// <summary>Читання даних із 1С запитами. Жодних прямих звернень до таблиць СУБД.</summary>
    public static class Repo
    {
        static readonly Dictionary<string, string> Catalogs = new Dictionary<string, string>
        {
            { "organizations", "Организации" }, { "customers", "Контрагенты" }, { "cars", "Автомобили" }, { "employees", "Сотрудники" },
            { "nomenclature", "Номенклатура" }, { "works", "Автоработы" }, { "warehouses", "СкладыКомпании" }, { "repairTypes", "ВидыРемонта" },
        };

        const string Esc = " СПЕЦСИМВОЛ \"\\\"";

        static string Like(string q)
        {
            var sb = new StringBuilder("%");
            foreach (char c in q)
            {
                if (c == '\\' || c == '%' || c == '_' || c == '[' || c == ']') sb.Append('\\');
                sb.Append(c);
            }
            return sb.Append('%').ToString();
        }

        static Dictionary<string, object> NameRef(object name)
        {
            string n = name as string;
            return string.IsNullOrEmpty(n) ? null : new Dictionary<string, object> { { "id", "" }, { "name", n } };
        }

        static double Num(object o) { return o is double ? (double)o : 0.0; }
        static string Txt(object o) { return o as string ?? ""; }
        static bool Flag(object o) { return o is bool && (bool)o; }
        static object Ref(object o) { return o is Dictionary<string, object> ? o : null; }

        public static Dictionary<string, object> ListWorkOrders(OneC db, string q, string state, int page, int pageSize)
        {
            if (page < 1) page = 1;
            if (page > 400) page = 400;
            if (pageSize < 1) pageSize = 25;
            if (pageSize > 200) pageSize = 200;
            var where = new StringBuilder("Т.ПометкаУдаления = ЛОЖЬ");
            var pars = new List<object>();
            if (!string.IsNullOrEmpty(q))
            {
                where.Append(" И (Т.Номер ПОДОБНО &Q" + Esc + " ИЛИ Т.Заказчик.Наименование ПОДОБНО &Q" + Esc + " ИЛИ Т.Автомобиль.Наименование ПОДОБНО &Q" + Esc + " ИЛИ Т.Автомобиль.VIN ПОДОБНО &Q" + Esc + ")");
                pars.Add("Q"); pars.Add(Like(q));
            }
            if (!string.IsNullOrEmpty(state))
            {
                object sr = db.StateRef(state);
                if (sr == null) return new Dictionary<string, object> { { "items", new List<object>() }, { "total", 0 } };
                where.Append(" И Т.Состояние = &Состояние");
                pars.Add("Состояние"); pars.Add(sr);
            }
            string tail = " ИЗ Документ.ЗаказНаряд КАК Т ГДЕ " + where;
            var cnt = db.Query("ВЫБРАТЬ КОЛИЧЕСТВО(*) КАК Н" + tail, new[] { "Н" }, pars.ToArray());
            var rows = db.Query(
                "ВЫБРАТЬ ПЕРВЫЕ " + (page * pageSize) + " Т.Ссылка КАК Ссылка, Т.Номер КАК Номер, Т.Дата КАК Дата, Т.Проведен КАК Проведен, ПРЕДСТАВЛЕНИЕ(Т.Состояние) КАК Состояние, " +
                "Т.Заказчик.Наименование КАК Заказчик, Т.Автомобиль.Наименование КАК Автомобиль, Т.СуммаДокумента КАК Сумма" + tail + " УПОРЯДОЧИТЬ ПО Т.Дата УБЫВ",
                new[] { "Ссылка", "Номер", "Дата", "Проведен", "Состояние", "Заказчик", "Автомобиль", "Сумма" }, new[] { "Ссылка" }, pars.ToArray());
            var items = new List<object>();
            for (int i = (page - 1) * pageSize; i < rows.Count; i++)
            {
                var r = rows[i];
                items.Add(new Dictionary<string, object>
                {
                    { "id", Txt(r["Ссылка"]) }, { "number", Txt(r["Номер"]) }, { "date", r["Дата"] }, { "state", Txt(r["Состояние"]) }, { "posted", Flag(r["Проведен"]) },
                    { "customer", NameRef(r["Заказчик"]) }, { "car", NameRef(r["Автомобиль"]) }, { "total", Num(r["Сумма"]) },
                });
            }
            return new Dictionary<string, object> { { "items", items }, { "total", (int)Num(cnt[0]["Н"]) } };
        }

        public static Dictionary<string, object> Summary(OneC db)
        {
            const string t = " ИЗ Документ.ЗаказНаряд КАК Т ГДЕ Т.ПометкаУдаления = ЛОЖЬ";
            var a = db.Query("ВЫБРАТЬ КОЛИЧЕСТВО(*) КАК Всего, МИНИМУМ(Т.Дата) КАК Мин, МАКСИМУМ(Т.Дата) КАК Макс" + t, new[] { "Всего", "Мин", "Макс" })[0];
            var p = db.Query("ВЫБРАТЬ КОЛИЧЕСТВО(*) КАК Н" + t + " И Т.Проведен", new[] { "Н" })[0];
            var st = db.Query("ВЫБРАТЬ ПРЕДСТАВЛЕНИЕ(Т.Состояние) КАК С, КОЛИЧЕСТВО(*) КАК К" + t + " СГРУППИРОВАТЬ ПО Т.Состояние", new[] { "С", "К" });
            var byState = new List<object>();
            foreach (var r in st) byState.Add(new Dictionary<string, object> { { "state", Txt(r["С"]) }, { "count", (int)Num(r["К"]) } });
            DateTime max;
            double cnt30 = 0, sum30 = 0;
            if (a["Макс"] is string && DateTime.TryParse((string)a["Макс"], CultureInfo.InvariantCulture, DateTimeStyles.None, out max))
            {
                var l = db.Query("ВЫБРАТЬ КОЛИЧЕСТВО(*) КАК К, СУММА(Т.СуммаДокумента) КАК С" + t + " И Т.Дата >= &С", new[] { "К", "С" }, "С", max.AddDays(-30))[0];
                cnt30 = Num(l["К"]); sum30 = Num(l["С"]);
            }
            return new Dictionary<string, object>
            {
                { "total", (int)Num(a["Всего"]) }, { "posted", (int)Num(p["Н"]) }, { "firstDate", a["Мин"] }, { "lastDate", a["Макс"] }, { "byState", byState },
                { "last30Days", new Dictionary<string, object> { { "count", (int)cnt30 }, { "amount", sum30 } } },
            };
        }

        public static Dictionary<string, object> GetWorkOrder(OneC db, string id)
        {
            object r = db.RefById("Документы", "ЗаказНаряд", id);
            var h = db.Query(
                "ВЫБРАТЬ Т.Номер КАК Номер, Т.Дата КАК Дата, Т.Проведен КАК Проведен, ПРЕДСТАВЛЕНИЕ(Т.Состояние) КАК Состояние, Т.Организация КАК Организация, Т.Заказчик КАК Заказчик, " +
                "Т.Автомобиль КАК Автомобиль, Т.Мастер КАК Мастер, Т.Менеджер КАК Менеджер, Т.ВидРемонта КАК ВидРемонта, Т.ПричинаОбращения КАК Причина, Т.Рекомендации КАК Рекомендации, " +
                "Т.ДатаНачала КАК Начало, Т.ДатаОкончания КАК Окончание, Т.СуммаДокумента КАК Сумма, Т.СуммаНоменклатурыДокумента КАК СуммаТоваров, Т.СуммаРаботДокумента КАК СуммаРабот " +
                "ИЗ Документ.ЗаказНаряд КАК Т ГДЕ Т.Ссылка = &Р",
                new[] { "Номер", "Дата", "Проведен", "Состояние", "Организация", "Заказчик", "Автомобиль", "Мастер", "Менеджер", "ВидРемонта", "Причина", "Рекомендации", "Начало", "Окончание", "Сумма", "СуммаТоваров", "СуммаРабот" },
                "Р", r);
            if (h.Count == 0) throw new ApiException(404, "Наряд-замовлення не знайдено.");
            var o = h[0];
            var parts = new List<object>();
            foreach (var x in db.Query(
                "ВЫБРАТЬ Т.Номенклатура КАК Н, Т.Количество КАК К, Т.ЕдиницаИзмерения КАК Е, Т.Цена КАК Ц, Т.ПроцентСкидки КАК С, Т.СкладКомпании КАК Ск, Т.Сумма КАК Сумма, Т.СуммаНДС КАК НДС " +
                "ИЗ Документ.ЗаказНаряд.Товары КАК Т ГДЕ Т.Ссылка = &Р УПОРЯДОЧИТЬ ПО Т.НомерСтроки",
                new[] { "Н", "К", "Е", "Ц", "С", "Ск", "Сумма", "НДС" }, "Р", r))
                parts.Add(new Dictionary<string, object> { { "item", Ref(x["Н"]) }, { "quantity", Num(x["К"]) }, { "unit", Ref(x["Е"]) }, { "price", Num(x["Ц"]) }, { "discountPercent", Num(x["С"]) }, { "warehouse", Ref(x["Ск"]) }, { "amount", Num(x["Сумма"]) }, { "vatAmount", Num(x["НДС"]) } });
            var works = new List<object>();
            foreach (var x in db.Query(
                "ВЫБРАТЬ Т.Работа КАК Р, Т.ИдентификаторРаботы КАК Ид, Т.Количество КАК К, Т.Нормочас КАК Нч, Т.Цена КАК Ц, Т.ПроцентСкидки КАК С, ПРЕДСТАВЛЕНИЕ(Т.Статус) КАК Ст, Т.Сумма КАК Сумма " +
                "ИЗ Документ.ЗаказНаряд.Работы КАК Т ГДЕ Т.Ссылка = &Р УПОРЯДОЧИТЬ ПО Т.НомерСтроки",
                new[] { "Р", "Ид", "К", "Нч", "Ц", "С", "Ст", "Сумма" }, "Р", r))
                works.Add(new Dictionary<string, object> { { "work", Ref(x["Р"]) }, { "lineKey", Txt(x["Ид"]) }, { "quantity", Num(x["К"]) }, { "normHours", Ref(x["Нч"]) }, { "price", Num(x["Ц"]) }, { "discountPercent", Num(x["С"]) }, { "status", Txt(x["Ст"]) }, { "amount", Num(x["Сумма"]) } });
            var performers = new List<object>();
            foreach (var x in db.Query(
                "ВЫБРАТЬ Т.ИдентификаторРаботы КАК Ид, Т.Исполнитель КАК Сотр, Т.Цех КАК Ц, Т.Процент КАК П ИЗ Документ.ЗаказНаряд.Исполнители КАК Т ГДЕ Т.Ссылка = &Р УПОРЯДОЧИТЬ ПО Т.НомерСтроки",
                new[] { "Ид", "Сотр", "Ц", "П" }, "Р", r))
                performers.Add(new Dictionary<string, object> { { "lineKey", Txt(x["Ид"]) }, { "employee", Ref(x["Сотр"]) }, { "workshop", Ref(x["Ц"]) }, { "percent", Num(x["П"]) } });
            return new Dictionary<string, object>
            {
                { "id", id.ToLowerInvariant() }, { "number", Txt(o["Номер"]) }, { "date", o["Дата"] }, { "state", Txt(o["Состояние"]) }, { "posted", Flag(o["Проведен"]) },
                { "organization", Ref(o["Организация"]) }, { "customer", Ref(o["Заказчик"]) }, { "car", Ref(o["Автомобиль"]) }, { "master", Ref(o["Мастер"]) }, { "manager", Ref(o["Менеджер"]) },
                { "repairType", Ref(o["ВидРемонта"]) }, { "reason", Txt(o["Причина"]) }, { "recommendations", Txt(o["Рекомендации"]) }, { "startDate", o["Начало"] }, { "endDate", o["Окончание"] },
                { "parts", parts }, { "works", works }, { "performers", performers },
                { "totalParts", Num(o["СуммаТоваров"]) }, { "totalWorks", Num(o["СуммаРабот"]) }, { "total", Num(o["Сумма"]) },
            };
        }

        public static List<object> Lookup(OneC db, string kind, string q, int limit)
        {
            string cat;
            if (!Catalogs.TryGetValue(kind, out cat)) throw new ApiException(404, "Невідомий довідник.");
            if (limit < 1 || limit > 200) limit = 30;
            var where = new StringBuilder(" ГДЕ Т.ПометкаУдаления = ЛОЖЬ");
            if (db.IsHierarchical(cat)) where.Append(" И НЕ Т.ЭтоГруппа");
            var pars = new List<object>();
            if (!string.IsNullOrEmpty(q))
            {
                where.Append(kind == "cars" ? " И (Т.Наименование ПОДОБНО &Q" + Esc + " ИЛИ Т.VIN ПОДОБНО &Q" + Esc + ")" : " И Т.Наименование ПОДОБНО &Q" + Esc);
                pars.Add("Q"); pars.Add(Like(q));
            }
            var rows = db.Query("ВЫБРАТЬ ПЕРВЫЕ " + limit + " Т.Ссылка КАК Ссылка, Т.Наименование КАК Имя ИЗ Справочник." + cat + " КАК Т" + where + " УПОРЯДОЧИТЬ ПО Т.Наименование",
                new[] { "Ссылка", "Имя" }, new[] { "Ссылка" }, pars.ToArray());
            var res = new List<object>();
            foreach (var r in rows) res.Add(new Dictionary<string, object> { { "id", Txt(r["Ссылка"]) }, { "name", Txt(r["Имя"]) } });
            return res;
        }
    }
}
