using System;
using System.Collections.Generic;
using System.Web.Script.Serialization;

namespace Kermo.Gateway
{
    public static class Json
    {
        static readonly JavaScriptSerializer S = new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 64 };

        public static string Write(object o) { return S.Serialize(o); }

        public static Dictionary<string, object> ReadObject(string s)
        {
            if (string.IsNullOrWhiteSpace(s)) return new Dictionary<string, object>();
            return S.Deserialize<Dictionary<string, object>>(s);
        }

        public static string Str(Dictionary<string, object> d, string key)
        {
            object v;
            return d.TryGetValue(key, out v) && v != null ? Convert.ToString(v) : "";
        }
    }

    public sealed class ApiException : Exception
    {
        public readonly int Status;
        public ApiException(int status, string message) : base(message) { Status = status; }
    }
}
